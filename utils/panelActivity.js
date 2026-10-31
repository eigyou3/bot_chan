const { ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelSelectMenuBuilder,ChannelType,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags }=require('discord.js');
const st=require('./store');
const {append}=require('./adminPanel');
const row=(...items)=>new ActionRowBuilder().addComponents(...items);
const button=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId('cfg_'+id).setLabel(label).setStyle(style);
async function handle(i){
 const id=i.customId.slice(4),d=st.get(i.guildId);
 if(id==='bumpmenu'){
   await i.reply({content:'**🔔 Bump通知**\\n現在の投稿先：'+(d.bump?.ch?'<#'+d.bump.ch+'>':'未設定')+'\\n@here：'+(d.bump?.here?'ON':'OFF'),components:[row(button('bumpchannel','投稿先を選択'),button('bumphere','@hereを切り替え'))],flags:MessageFlags.Ephemeral});return;
 }
 if(id==='bumphere'){
   if(!d.bump?.ch)return i.reply({content:'先にBumpの投稿先を指定してください。',flags:MessageFlags.Ephemeral});
   const ch=await i.guild.channels.fetch(d.bump.ch).catch(()=>null);
   if(!ch)return i.reply({content:'投稿先が見つかりません。',flags:MessageFlags.Ephemeral});
   try{await require('./bump').configure(ch,!d.bump.here);await append(i.guild,i.user.id,'Bumpの@hereを'+(d.bump.here?'ON':'OFF')+'に変更');
     await i.reply({content:'✅ @here：'+(d.bump.here?'ON':'OFF'),flags:MessageFlags.Ephemeral});
   }catch(e){await i.reply({content:'⚠️ '+e.message,flags:MessageFlags.Ephemeral});}return;
 }
 if(id==='bumpchannel'){
   await i.reply({content:'Bumpの投稿先を選んでください。',components:[row(new ChannelSelectMenuBuilder().setCustomId('cfg_bumpselected').addChannelTypes(ChannelType.GuildText))],flags:MessageFlags.Ephemeral});return;
 }
 if(id==='bumpselected'){
   const ch=await i.guild.channels.fetch(i.values[0]).catch(()=>null);
   if(!ch?.send||ch.id===st.findCh(i.guild)?.id)return i.update({content:'通常のテキストチャンネルを選んでください。',components:[]});
   try{await require('./bump').configure(ch,d.bump?.here||false);await append(i.guild,i.user.id,'Bump通知先を <#'+ch.id+'> に設定');
     await i.update({content:'✅ Bump通知先：<#'+ch.id+'>',components:[],allowedMentions:{parse:[]}});
   }catch(e){await i.update({content:'⚠️ '+e.message,components:[]});}return;
 }
 if(id==='vcrmenu'){
  await i.reply({content:'**🏆 VCランキング**\n現在：'+(d.rkOff?'OFF':'ON')+'\n通知先：'+(d.vc?'<#'+d.vc+'>':'未設定'),components:[row(button('vcron','ON',ButtonStyle.Success),button('vcroff','OFF',ButtonStyle.Danger))],flags:MessageFlags.Ephemeral});return;
 }
 if(id==='vcron'||id==='vcroff'){
  if(id==='vcron'&&!d.vc)return i.reply({content:'先にVC通知先を設定してください。',flags:MessageFlags.Ephemeral});
  const previous=d.rkOff;d.rkOff=id==='vcroff';
  try{if(d.rkOff)await require('./vcrank').stop(i.guild);else await require('./vcrank').start(i.guild);
    if(!await st.save(i.guild))throw Error('設定を保存できませんでした。');
    await append(i.guild,i.user.id,'VCランキングを'+(d.rkOff?'OFF':'ON')+'に変更');
    await i.reply({content:'✅ VCランキングを'+(d.rkOff?'OFF':'ON')+'にしました。',flags:MessageFlags.Ephemeral});
  }catch(e){d.rkOff=previous;await i.reply({content:'⚠️ '+e.message,flags:MessageFlags.Ephemeral});}return;
 }
 if(id==='alarmmenu'){
  const list=(d.alarms||[]).map((a,n)=>String(n+1)+'. '+a.time+' '+a.msg.slice(0,30)+' → <#'+a.ch+'>').join('\n')||'登録なし';
  await i.reply({content:'**⏰ アラーム管理**\n'+list,components:[row(button('alarmchannel','アラームを追加'),button('alarmdelete','アラームを削除',ButtonStyle.Danger))],flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});return;
 }
 if(id==='alarmchannel'){
  await i.reply({content:'アラームの通知先を選択してください。',components:[row(new ChannelSelectMenuBuilder().setCustomId('cfg_alarmselected').addChannelTypes(ChannelType.GuildText))],flags:MessageFlags.Ephemeral});return;
 }
 if(id==='alarmselected'){
  const cid=i.values[0],ch=await i.guild.channels.fetch(cid).catch(()=>null);
  if(!ch?.send||cid===st.findCh(i.guild)?.id)return i.update({content:'通常の投稿可能なチャンネルを選んでください。',components:[]});
  const me=i.guild.members.me||await i.guild.members.fetchMe(),P=require('discord.js').PermissionFlagsBits;
  if(!ch.permissionsFor(me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))return i.update({content:'通知先でBotの閲覧・送信・埋め込みリンク権限が必要です。',components:[]});
  const modal=new ModalBuilder().setCustomId('cfg_alarmform_'+cid).setTitle('毎日のアラームを追加');
  modal.addComponents(row(new TextInputBuilder().setCustomId('alarmtime').setLabel('時刻（例 21:00）').setStyle(TextInputStyle.Short).setRequired(true)),
    row(new TextInputBuilder().setCustomId('alarmtext').setLabel('通知する文章').setStyle(TextInputStyle.Paragraph).setMaxLength(1800).setRequired(true)));
  await i.showModal(modal);return;
 }
 if(id.startsWith('alarmform_')){
  const cid=id.slice(10),time=i.fields.getTextInputValue('alarmtime').trim(),msg=i.fields.getTextInputValue('alarmtext').trim();
  if(!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time))return i.reply({content:'時刻は21:00の形式で入力してください。',flags:MessageFlags.Ephemeral});
  const norm=time.padStart(5,'0');
  if(!Array.isArray(d.alarms))d.alarms=[];
  if(d.alarms.some(a=>a.ch===cid&&a.time===norm&&a.msg===msg))return i.reply({content:'同じアラームが登録されています。',flags:MessageFlags.Ephemeral});
  const entry={time:norm,ch:cid,msg,by:i.user.id,byName:i.member?.displayName||i.user.username,byAvatar:i.user.displayAvatarURL()};
  d.alarms.push(entry);
  if(!await st.save(i.guild)){d.alarms.pop();return i.reply({content:'保存に失敗しました。',flags:MessageFlags.Ephemeral});}
  await append(i.guild,i.user.id,'アラーム '+norm+' を <#'+cid+'> に追加');
  await i.reply({content:'✅ 毎日'+norm+'に <#'+cid+'> へ通知します。',flags:MessageFlags.Ephemeral});return;
 }
 if(id==='alarmdelete'){
  const list=d.alarms||[];
  if(!list.length)return i.reply({content:'削除するアラームがありません。',flags:MessageFlags.Ephemeral});
  const menu=new (require('discord.js').StringSelectMenuBuilder)().setCustomId('cfg_alarmremove').setPlaceholder('削除するアラームを選択')
    .addOptions(list.slice(0,25).map((a,n)=>({label:(a.time+' '+a.msg).slice(0,95),value:String(n),description:'通知先: '+a.ch})));
  await i.reply({content:'削除するアラームを選んでください。',components:[row(menu)],flags:MessageFlags.Ephemeral});return;
 }
 if(id==='alarmremove'){
  const n=Number(i.values[0]),list=d.alarms||[];
  if(!Number.isInteger(n)||!list[n])return i.update({content:'対象が見つかりません。',components:[]});
  const removed=list.splice(n,1)[0];
  if(!await st.save(i.guild)){list.splice(n,0,removed);return i.update({content:'保存できませんでした。',components:[]});}
  await append(i.guild,i.user.id,'アラーム '+removed.time+' を削除');
  await i.update({content:'✅ アラームを削除しました。',components:[]});return;
 }
}
module.exports={handle};