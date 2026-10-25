const { EmbedBuilder, MessageFlags } = require('discord.js');
const st = require('./store');

// 週間VCランキング
// 集計は日曜21:00区切り、人間2人以上いる時だけカウント（botは数えない）
// ひとりで30分以上 → 特賞

const SOLO_MIN = 30 * 60;
const KING = '今週のVC王';
const SOLO_KING = 'ソロでもプレイ王';
const COLOR = '#534AB7';

const lastSv = new Map();

const blankWk = wk => ({ wk, calls: 0, total: 0, start: {}, last: {}, time: {}, solo: {} });

// 直近の日曜21:00(JST)
function weekStart(t = Date.now()) {
  const j = new Date(t + 9 * 3600000);
  const d = new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate(), 21));
  d.setUTCDate(d.getUTCDate() - j.getUTCDay());
  if (d > j) d.setUTCDate(d.getUTCDate() - 7);
  return d.getTime() - 9 * 3600000;
}

function fmt(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? `${h}時間${String(m).padStart(2, '0')}分` : `${m}分`;
}

function day(ms) {
  const j = new Date(ms + 9 * 3600000);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()}（${'日月火水木金土'[j.getUTCDay()]}）21:00`;
}

function vd(gid) {
  const d = st.get(gid);
  if (!d.vcr) d.vcr = { cur: blankWk(weekStart()), sess: {}, msg: null, res: null, ts: Date.now() };
  return d.vcr;
}

// setvc済み＆OFFにしてない時だけ動く
const on = gid => !!st.get(gid).vc && !st.get(gid).rkOff;

const humans = ch => ch.members.filter(m => !m.user.bot);
const add = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };

// 前回からの経過分を足し込む
function accrue(g, now = Date.now()) {
  const r = vd(g.id);
  const dt = Math.max(0, (now - r.ts) / 1000);
  r.ts = now;
  // イベントは抜けた後の状態で来るので、前回覚えた顔ぶれで数える
  for (const s of Object.values(r.sess)) {
    const hs = s.hs || [];
    if (hs.length >= 2) {
      r.cur.total += dt;
      hs.forEach(id => add(r.cur.time, id, dt));
    } else if (hs.length === 1 && s.solo) {
      s.soloT = (s.soloT || 0) + dt;
    }
  }
}

// ひとり時間の区切り
function endSolo(r, s) {
  if (s.solo && (s.soloT || 0) >= SOLO_MIN) add(r.cur.solo, s.solo, s.soloT);
  s.solo = null;
  s.soloT = 0;
}

// VCの状態に合わせてセッションを更新
function sync(g, cid, leaver) {
  const r = vd(g.id);
  const ch = g.channels.cache.get(cid);
  if (!ch || cid === g.afkChannelId) return false;
  const hs = humans(ch);
  let s = r.sess[cid];

  if (!hs.size) {
    if (s) {
      endSolo(r, s);
      if (s.multi && leaver) add(r.cur.last, leaver);
      delete r.sess[cid];
      return s.multi;  // 2人以上の通話が終わった
    }
    return false;
  }

  if (!s) s = r.sess[cid] = { starter: hs.first().id, since: Date.now(), multi: false, solo: null, soloT: 0 };
  s.hs = [...hs.keys()];

  if (hs.size >= 2) {
    endSolo(r, s);
    if (!s.multi) {
      s.multi = true;
      r.cur.calls++;
      if (s.starter) add(r.cur.start, s.starter);
    }
  } else {
    const id = hs.first().id;
    if (s.solo !== id) { endSolo(r, s); s.solo = id; }
  }
  return false;
}

async function onVoice(o, n) {
  const g = n.guild;
  if (n.member?.user.bot) return;
  if (o.channelId === n.channelId) return;
  if (!on(g.id)) return;
  await rollover(g);
  accrue(g);
  const end = o.channelId ? sync(g, o.channelId, n.member.id) : false;
  if (n.channelId) sync(g, n.channelId);
  st.saveLater(g);
  // 通話が終わった時だけ途中経過を出す
  if (end) await post(g);
}

// 1位（同率は全部）
function top(o) {
  const v = Math.max(0, ...Object.values(o));
  if (!v) return { v: 0, ids: [] };
  return { v, ids: Object.keys(o).filter(k => o[k] === v) };
}

function build(g, w, done) {
  const ms = ids => ids.map(i => `<@${i}>`).join('・');
  const line = (lb, o, f) => { const t = top(o); return t.ids.length ? `${lb}1位　${ms(t.ids)} さん（${f(t.v)}）` : null; };
  const rk = [
    line('通話を始めた回数', w.start, v => `${v}回`),
    line('通話に最後までいた回数', w.last, v => `${v}回`),
    line('累計通話時間', w.time, fmt),
  ].filter(Boolean);

  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(done ? '先週のVCランキング（確定）' : '今週のVCランキング（途中経過）')
    .setDescription(`${day(w.wk)} 〜 ${day(w.wk + 7 * 86400000)}`)
    .addFields(
      { name: '累計通話回数', value: `${w.calls}回`, inline: true },
      { name: '累計通話時間', value: fmt(w.total), inline: true },
    );

  let txt = rk.join('\n');
  if (done && rk.length) txt += `\nに、ロール：${roleTxt(g, KING)} を付与したよ！`;
  if (txt) e.addFields({ name: '​', value: txt });

  // 特賞は確定版だけ、いる時だけ
  const sl = Object.entries(w.solo).sort((a, b) => b[1] - a[1]);
  if (done && sl.length) {
    e.addFields({
      name: '特賞　ひとりでもVC賞',
      value: sl.map(([i, t]) => `<@${i}> さん（ひとりで${fmt(t)}）`).join('\n') + `\nに、ロール：${roleTxt(g, SOLO_KING)} を付与したよ！`,
    });
  }

  if (!done) e.setFooter({ text: '日曜 21:00 に確定' });
  return e;
}

// ロールがあればメンション表記、無ければ名前だけ
function roleTxt(g, nm) {
  const r = g.roles.cache.find(x => x.name === nm);
  return r ? `<@&${r.id}>` : nm;
}

// 途中経過を投稿し直す（張り付かせない）
async function post(g) {
  const d = st.get(g.id);
  const ch = d.vc && g.channels.cache.get(d.vc);
  if (!ch) return;
  const r = vd(g.id);
  if (r.msg) await ch.messages.delete(r.msg).catch(() => null);
  const m = await ch.send({ embeds: [build(g, r.cur, false)], flags: MessageFlags.SuppressNotifications }).catch(() => null);
  r.msg = m?.id || null;
  st.saveLater(g);
}

async function roles(g, w) {
  const k = g.roles.cache.find(x => x.name === KING);
  const s = g.roles.cache.find(x => x.name === SOLO_KING);
  if (!k && !s) return;
  await g.members.fetch().catch(() => null);

  if (k) {
    const win = new Set([...top(w.start).ids, ...top(w.last).ids, ...top(w.time).ids]);
    for (const m of k.members.values()) if (!win.has(m.id)) await m.roles.remove(k).catch(() => null);
    for (const id of win) await g.members.cache.get(id)?.roles.add(k).catch(() => null);
  }
  // ソロ王は付けるだけ
  if (s) for (const id of Object.keys(w.solo)) await g.members.cache.get(id)?.roles.add(s).catch(() => null);
}

// 週の切り替え
async function rollover(g) {
  const r = vd(g.id);
  const wk = weekStart();
  if (r.cur.wk === wk) return false;

  accrue(g, r.cur.wk + 7 * 86400000);
  for (const s of Object.values(r.sess)) endSolo(r, s);
  const old = r.cur;

  const d = st.get(g.id);
  const ch = d.vc && g.channels.cache.get(d.vc);
  if (ch) {
    if (r.msg) await ch.messages.delete(r.msg).catch(() => null);
    if (r.res) await ch.messages.delete(r.res).catch(() => null);
    r.res = null;
    // 誰も通話してない週は何も出さない
    if (old.calls || Object.keys(old.solo).length) {
      await roles(g, old);
      const m = await ch.send({ embeds: [build(g, old, true)] }).catch(() => null);
      r.res = m?.id || null;
    }
  }
  r.msg = null;

  // 続いてる通話は新しい週の1回目として持ち越し（始めた人はカウントしない）
  r.cur = blankWk(wk);
  r.cur.calls = Object.values(r.sess).filter(s => s.multi).length;
  r.ts = Date.now();
  await st.save(g);
  return true;
}

// 起動時：保存してたセッションと今のVCを突き合わせ
async function init(client) {
  for (const g of client.guilds.cache.values()) {
    if (!on(g.id)) continue;
    const r = vd(g.id);
    r.ts = Date.now();  // 落ちてた間は数えない
    for (const cid of Object.keys(r.sess)) {
      const ch = g.channels.cache.get(cid);
      if (!ch || !humans(ch).size) delete r.sess[cid];
    }
    g.channels.cache.filter(c => c.isVoiceBased() && c.id !== g.afkChannelId && humans(c).size).forEach(c => {
      if (!r.sess[c.id]) r.sess[c.id] = { starter: null, since: Date.now(), multi: humans(c).size >= 2, solo: null, soloT: 0 };
      sync(g, c.id);
    });
    await rollover(g);
  }
}

// 毎分：時間の足し込みと週替わりチェック
async function tick(client) {
  for (const g of client.guilds.cache.values()) {
    if (!on(g.id)) continue;
    await rollover(g);
    const r = vd(g.id);
    if (!Object.keys(r.sess).length) continue;
    accrue(g);
    for (const cid of Object.keys(r.sess)) sync(g, cid);
    // 通話中の保存は5分おき
    if (Date.now() - (lastSv.get(g.id) || 0) > 300000) {
      lastSv.set(g.id, Date.now());
      st.saveLater(g, 1000);
    }
  }
}

// OFFにする時：途中経過は消して、通話中のセッションは捨てる（集計は残す）
async function stop(g) {
  const d = st.get(g.id);
  const r = d.vcr;
  if (!r) return;
  const ch = d.vc && g.channels.cache.get(d.vc);
  if (ch && r.msg) await ch.messages.delete(r.msg).catch(() => null);
  r.msg = null;
  r.sess = {};
}

// ONに戻す時：今VCにいる人から数え直し
async function start(g) {
  const r = vd(g.id);
  // OFF中に週が変わってたら、古い週は確定させずに捨てる
  if (r.cur.wk !== weekStart()) r.cur = blankWk(weekStart());
  r.ts = Date.now();
  r.sess = {};
  g.channels.cache.filter(c => c.isVoiceBased() && c.id !== g.afkChannelId && humans(c).size).forEach(c => {
    r.sess[c.id] = { starter: null, since: Date.now(), multi: humans(c).size >= 2, solo: null, soloT: 0 };
    sync(g, c.id);
  });
  await rollover(g);
}

module.exports = { onVoice, init, tick, humans, stop, start };
