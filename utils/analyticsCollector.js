// 日別のサーバー指標を蓄積する。分析UIとは独立して保存する。
const st = require('./store');
const ZONE = 'Asia/Tokyo';
const live = new Map();
const MAX_DAYS = 400;
const dayKey = (at=Date.now()) => new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
function history(g){
  const d=st.get(g.id);
  if(!d.analyticsDaily || typeof d.analyticsDaily!=='object')d.analyticsDaily={};
  return d.analyticsDaily;
}
function record(g,at=Date.now()){
  const days=history(g),key=dayKey(at);
  if(!days[key])days[key]={members:g.memberCount||0,joins:0,leaves:0,vcCalls:0,vcSeconds:0,observedAt:at};
  return days[key];
}
function prune(g){
  const d=history(g),keys=Object.keys(d).sort();
  for(const k of keys.slice(0,Math.max(0,keys.length-MAX_DAYS)))delete d[k];
}
function sampleMembers(g,at=Date.now()){
  const d=record(g,at);d.members=g.memberCount||d.members;d.observedAt=at;prune(g);st.saveLater(g,60000);
}
function memberEvent(g,kind){
  const d=record(g);
  d[kind]++; // イベントを受信した件数だけ計上（過去分は補完しない）
  d.members=g.memberCount||d.members;
  d.observedAt=Date.now();prune(g);st.saveLater(g,10000);
}
function voiceChannels(g){
  return new Set(g.channels.cache.filter(c=>(c.type===2)&&c.id!==g.afkChannelId&&c.members.filter(m=>!m.user.bot).size>=2).map(c=>c.id));
}
function accrue(g,now=Date.now()){
  const prev=live.get(g.id);
  if(!prev){live.set(g.id,{at:now,channels:voiceChannels(g)});return;}
  // Bot停止・イベント滞留中の時間を埋めない。
  const elapsed=Math.max(0,Math.min((now-prev.at)/1000,120));
  if(elapsed){
    const start=prev.at;
    const end=prev.at+elapsed*1000;
    const k1=dayKey(start),k2=dayKey(end);
    if(k1===k2){record(g,start).vcSeconds+=elapsed*prev.channels.size;}
    else {
      // JST日付境界を二分探索で求める。
      let lo=start,hi=end;
      while(hi-lo>1){const m=Math.floor((lo+hi)/2);if(dayKey(m)===k1)lo=m;else hi=m;}
      record(g,start).vcSeconds+=Math.max(0,(hi-start)/1000)*prev.channels.size;
      record(g,end).vcSeconds+=Math.max(0,(end-hi)/1000)*prev.channels.size;
    }
  }
  prev.at=now;
}
function voiceChanged(g){
  const now=Date.now();
  if(!live.has(g.id)){live.set(g.id,{at:now,channels:voiceChannels(g)});return;}
  accrue(g,now);
  const prev=live.get(g.id),next=voiceChannels(g);
  for(const id of next)if(!prev.channels.has(id))record(g,now).vcCalls++;
  prev.channels=next;
  prune(g);st.saveLater(g,60000);
}
function initialize(client){
  for(const g of client.guilds.cache.values()){
    live.set(g.id,{at:Date.now(),channels:voiceChannels(g)});
    sampleMembers(g);
  }
}
function tick(client){
  for(const g of client.guilds.cache.values()){
    if(!live.has(g.id)){live.set(g.id,{at:Date.now(),channels:voiceChannels(g)});sampleMembers(g);continue;}
    voiceChanged(g);sampleMembers(g);
  }
}
module.exports={initialize,tick,voiceChanged,sampleMembers,memberEvent,dayKey};
