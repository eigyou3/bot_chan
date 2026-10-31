const { EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,PermissionFlagsBits:P }=require('discord.js');
const st=require('./store');
const REQUIRED=[
  ['チャンネルを見る',P.ViewChannel],
  ['メッセージを送信',P.SendMessages],
  ['メッセージ履歴を読む',P.ReadMessageHistory],
  ['埋め込みリンク',P.EmbedLinks],
  ['ファイルを添付',P.AttachFiles],
  ['チャンネルの管理',P.ManageChannels],
  ['ロールの管理',P.ManageRoles],
  ['メンバーをキック',P.KickMembers],
  ['@everyone・@hereにメンション',P.MentionEveryone],
  ['監査ログを表示',P.ViewAuditLog]
];
async function status(g){
  const me=g.members.me||await g.members.fetchMe();
  const ch=st.findCh(g);
  const missing=REQUIRED.filter(([,flag])=>!me.permissions.has(flag)).map(([label])=>label);
  if(ch){
    const chRequired=[['チャンネルを見る',P.ViewChannel],['メッセージを送信',P.SendMessages],['メッセージ履歴を読む',P.ReadMessageHistory],['埋め込みリンク',P.EmbedLinks],['ファイルを添付',P.AttachFiles]];
    for(const [label,flag] of chRequired)if(!ch.permissionsFor(me)?.has(flag))missing.push('#bot-config：'+label);
  }
  return [...new Set(missing)];
}
function view(missing){
  return {embeds:[new EmbedBuilder().setColor(missing.length?'#BA7517':'#1D9E75')
    .setTitle('🔐 Botの権限チェックリスト')
    .setDescription(missing.length?
      '不足している権限をまとめて許可してください。\n\n'+missing.map(x=>'☐ '+x).join('\n'):
      '✅ 必要な権限はすべて許可されています。下のボタンでこの案内を非表示にできます。')],
    components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cfg_permhide')
      .setLabel('チェックリストを非表示').setStyle(ButtonStyle.Success).setDisabled(missing.length!==0))],
    allowedMentions:{parse:[]}};
}
async function refresh(g){
  const ch=st.findCh(g);if(!ch)return;
  const missing=await status(g);
  const d=st.get(g.id);
  let msg=d.permissionChecklistId&&await ch.messages.fetch(d.permissionChecklistId).catch(()=>null);
  if(!msg){
    const recent=await ch.messages.fetch({limit:30}).catch(()=>null);
    msg=recent?.find(x=>x.author.id===g.client.user.id&&x.embeds[0]?.title==='🔐 Botの権限チェックリスト');
  }
  if(!missing.length&&d.permissionChecklistHidden){
    if(msg)await msg.delete().catch(()=>null);
    if(d.permissionChecklistId){d.permissionChecklistId=null;await st.save(g);}
    return;
  }
  if(missing.length)d.permissionChecklistHidden=false;
  if(msg)await msg.edit(view(missing));
  else msg=await ch.send(view(missing));
  if(d.permissionChecklistId!==msg.id){d.permissionChecklistId=msg.id;await st.save(g);}
}
async function hide(i){
  const missing=await status(i.guild);
  if(missing.length)return i.reply({content:'権限が不足しているため非表示にできません。',ephemeral:true});
  st.get(i.guildId).permissionChecklistHidden=true;
  await st.save(i.guild);
  await i.message.delete();
  st.get(i.guildId).permissionChecklistId=null;
  await st.save(i.guild);
}
module.exports={status,refresh,hide};
