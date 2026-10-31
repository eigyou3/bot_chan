const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelSelectMenuBuilder,RoleSelectMenuBuilder,ChannelType,MessageFlags,PermissionFlagsBits:P}=require('discord.js');
const st=require('./store');
const inactive=require('./inactive');
const {append}=require('./adminPanel');
const row=(...items)=>new ActionRowBuilder().addComponents(...items);
const btn=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId('cfg_'+id).setLabel(label).setStyle(style);
function screen(i){
 const d=st.get(i.guildId),s=d.inactive||{},months=s.months||d.inactiveMonths||3;
 return {content:['**🛡️ 非アクティブ管理**','状態：'+(s.enabled?'ON':'OFF'),'判定：'+months+'か月','ログ：'+(s.log?'<#'+s.log+'>':'未設定'),'対象ロール：'+(s.role?'<@&'+s.role+'>':'未設定'),'除外ロール：'+(s.exclude?'<@&'+s.exclude+'>':'なし'),'警告DMの7日後に活動も回答もない場合のみキックします。'].join('\n'),
 components:[row(btn('inactive_log','ログ送信先'),btn('inactive_role','対象ロール'),btn('inactive_exclude','除外ロール')),
 row(btn('inactive_enable','有効化',ButtonStyle.Success),btn('inactive_disable','停止',ButtonStyle.Danger))],flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}};
}
async function handle(i){
 const id=i.customId.slice(4),d=st.get(i.guildId),s=d.inactive||{};
 if(id==='inactive_menu')return i.reply(screen(i));
 if(['inactive_log','inactive_role','inactive_exclude'].includes(id)){
  const picker=id==='inactive_log'?
    new ChannelSelectMenuBuilder().setCustomId('cfg_inactive_setlog').addChannelTypes(ChannelType.GuildText):
    new RoleSelectMenuBuilder().setCustomId('cfg_inactive_'+(id==='inactive_role'?'setrole':'setexclude'));
  return i.reply({content:'設定先を選択してください。',components:[row(picker)],flags:MessageFlags.Ephemeral});
 }
 if(['inactive_setlog','inactive_setrole','inactive_setexclude'].includes(id)){
  const selected=i.values?.[0],key=id.slice('inactive_set'.length);
  if(!selected)return i.update({content:'選択できませんでした。',components:[]});
  const me=i.guild.members.me||await i.guild.members.fetchMe();
  if(key==='log'){
   const ch=await i.guild.channels.fetch(selected).catch(()=>null);
   if(!ch?.isTextBased()||!ch.permissionsFor(me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))return i.update({content:'Botが閲覧・送信できるログ用チャンネルを選んでください。',components:[]});
  }else if(key==='role'){
   try{await inactive.managedRole(i.guild,selected);}catch(e){return i.update({content:'⚠️ '+e.message,components:[]});}
   if(s.enabled&&Object.values(s.users||{}).some(u=>u.suspendedRole||u.restoreRole))return i.update({content:'ロール復元待ちのメンバーがいるため変更できません。先に復元を完了してください。',components:[]});
  }
  const old={...s},setting=d.inactiveSettings||{};
  setting[key]=selected;d.inactiveSettings=setting;
  if(d.inactive){
   if(key==='log')d.inactive.log=selected;
   if(key==='role')d.inactive.role=selected;
   if(key==='exclude')d.inactive.exclude=selected;
  }
  if(!await st.save(i.guild)){if(d.inactive)Object.assign(d.inactive,old);return i.update({content:'設定保存に失敗しました。',components:[]});}
  await append(i.guild,i.user.id,'非アクティブ管理の'+({log:'ログ先',role:'対象ロール',exclude:'除外ロール'})[key]+'を変更');
  return i.update({content:'✅ 設定しました。非アクティブ管理を再度開いて確認できます。',components:[]});
 }
 if(id==='inactive_enable'){
  if(s.enabled)return i.reply({content:'すでに有効です。',flags:MessageFlags.Ephemeral});
  const settings=d.inactiveSettings||{},log=settings.log||s.log,role=settings.role||s.role;
  if(!log||!role)return i.reply({content:'先にログ送信先と対象ロールを選択してください。',flags:MessageFlags.Ephemeral});
  const me=i.guild.members.me||await i.guild.members.fetchMe();
  if(!me.permissions.has(P.KickMembers))return i.reply({content:'Botに「メンバーをキック」権限が必要です。',flags:MessageFlags.Ephemeral});
  const ch=await i.guild.channels.fetch(log).catch(()=>null);
  if(!ch?.permissionsFor(me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))return i.reply({content:'ログ送信先の権限が不足しています。',flags:MessageFlags.Ephemeral});
  try{await inactive.managedRole(i.guild,role);}catch(e){return i.reply({content:'⚠️ '+e.message,flags:MessageFlags.Ephemeral});}
  if(Object.values(s.users||{}).some(u=>u.suspendedRole||u.restoreRole))return i.reply({content:'復元待ちロールがあるため開始できません。',flags:MessageFlags.Ephemeral});
  return i.reply({content:'⚠️ **最終確認**\n'+(s.months||d.inactiveMonths||3)+'か月活動がない人に警告DMを送り、さらに7日間無反応・無活動の場合は自動キックします。\n有効化すると、今日から活動判定を開始します。',components:[row(btn('inactive_confirm','自動キック管理を有効化',ButtonStyle.Danger),btn('inactive_cancel','キャンセル'))],flags:MessageFlags.Ephemeral});
 }
 if(id==='inactive_cancel')return i.update({content:'キャンセルしました。',components:[]});
 if(id==='inactive_confirm'){
  if(s.enabled)return i.update({content:'すでに有効です。',components:[]});
  const settings=d.inactiveSettings||{},log=settings.log||s.log,role=settings.role||s.role;
  const me=i.guild.members.me||await i.guild.members.fetchMe();
  const ch=log&&await i.guild.channels.fetch(log).catch(()=>null);
  if(!role||!ch?.permissionsFor(me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks])||!me.permissions.has(P.KickMembers))return i.update({content:'必要な設定または権限が不足しています。',components:[]});
  try{await inactive.managedRole(i.guild,role);}catch(e){return i.update({content:'⚠️ '+e.message,components:[]});}
  const old=d.inactive,now=Date.now();
  d.inactive={enabled:true,since:now,seenAt:now,checkedAt:0,log,role,exclude:settings.exclude||s.exclude||null,months:d.inactiveMonths||s.months||3,users:{}};
  if(!await st.save(i.guild)){d.inactive=old;return i.update({content:'保存に失敗したため有効化していません。',components:[]});}
  await append(i.guild,i.user.id,'非アクティブ管理を有効化');
  return i.update({content:'✅ 非アクティブ管理を有効にしました。',components:[]});
 }
 if(id==='inactive_disable'){
  if(!s.enabled)return i.reply({content:'すでに停止しています。',flags:MessageFlags.Ephemeral});
  s.enabled=false;
  const failed=await inactive.restoreSuspended(i.guild,s);
  if(!await st.save(i.guild))return i.reply({content:'⚠️ 保存に失敗しました。再起動前に再度停止してください。',flags:MessageFlags.Ephemeral});
  await append(i.guild,i.user.id,'非アクティブ管理を停止');
  return i.reply({content:failed?'⚠️ 停止しましたが、'+failed+'人のロール復元に失敗しました。':'✅ 非アクティブ管理を停止しました。',flags:MessageFlags.Ephemeral});
 }
}
module.exports={handle};
