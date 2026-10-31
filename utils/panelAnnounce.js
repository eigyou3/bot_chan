const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, FileUploadBuilder, MessageFlags } = require('discord.js');
const st = require('./store');
const drafts = new Map();
const key = i => i.guildId+':'+i.user.id;
const get = i => {
  const k=key(i);let d=drafts.get(k);
  if (!d || Date.now()-d.at>15*60000) {d={at:Date.now(),ch:null,ids:[],sticky:false};drafts.set(k,d);}
  return d;
};
const btn=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId('cfg_'+id).setLabel(label).setStyle(style);
const row=(...x)=>new ActionRowBuilder().addComponents(...x);
async function handle(i,client){
  const id=i.customId.slice(4),d=get(i);
  if(id==='annopen') {
    await i.reply({content:'**📣 アナウンス作成**\n投稿先：'+(d.ch?'<#'+d.ch+'>':'未設定')+'\nロール：'+(d.ids.length?d.ids.map(x=>'<@&'+x+'>').join('、'):'なし')+'\n常駐：'+(d.sticky?'ON':'OFF'),components:[
      row(btn('annchoose','投稿先'),btn('annroles','ロールを選択')),
      row(btn('annsticky','常駐を切り替え'),btn('annwrite','本文・画像を入力',ButtonStyle.Success))
    ],flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});return;
  }
  if(id==='annchoose'){
    await i.reply({content:'投稿先を選んでください。',components:[row(new ChannelSelectMenuBuilder().setCustomId('cfg_annchosen').addChannelTypes(ChannelType.GuildText))],flags:MessageFlags.Ephemeral});return;
  }
  if(id==='annroles'){
    await i.reply({content:'付与・解除ボタンにするロールを最大5つ選んでください。',components:[row(new RoleSelectMenuBuilder().setCustomId('cfg_annroleschosen').setMinValues(0).setMaxValues(5))],flags:MessageFlags.Ephemeral});return;
  }
  if(id==='annsticky'){d.sticky=!d.sticky;await i.reply({content:'✅ 常駐：'+(d.sticky?'ON':'OFF')+'。アナウンス作成画面に戻ってください。',flags:MessageFlags.Ephemeral});return;}
  if(id==='annchosen'){
    const ch=await i.guild.channels.fetch(i.values[0]).catch(()=>null);
    const me=i.guild.members.me || await i.guild.members.fetchMe();
    const P=require('discord.js').PermissionFlagsBits;
    if(!ch || !ch.isTextBased() || ch.id===st.findCh(i.guild)?.id || !ch.permissionsFor(me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ReadMessageHistory])) {
      await i.update({content:'投稿できる通常のテキストチャンネルを選んでください。',components:[]});return;
    }
    d.ch=ch.id;await i.update({content:'✅ 投稿先を <#'+ch.id+'> に選択しました。アナウンス作成画面に戻ってください。',components:[],allowedMentions:{parse:[]}});return;
  }
  if(id==='annroleschosen'){d.ids=i.values.slice(0,5);await i.update({content:'✅ ロールを選びました。アナウンス作成画面に戻ってください。',components:[]});return;}
  if(id==='annwrite'){
    if(!d.ch){await i.reply({content:'先に投稿先チャンネルを選んでください。',flags:MessageFlags.Ephemeral});return;}
    const cmd=client.commands.get('announce');
    if(!cmd?.pend){await i.reply({content:'アナウンス機能が利用できません。',flags:MessageFlags.Ephemeral});return;}
    cmd.pend.set(i.id,{ids:d.ids,sticky:d.sticky,ch:d.ch,by:i.user.id});
    const modal=new ModalBuilder().setCustomId('ann_mdl_'+i.id).setTitle('アナウンス内容の入力');
    modal.addLabelComponents(
      new LabelBuilder().setLabel('案内文章').setTextInputComponent(new TextInputBuilder().setCustomId('announce_text').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new LabelBuilder().setLabel('画像（任意）').setFileUploadComponent(new FileUploadBuilder().setCustomId('announce_img').setRequired(false).setMaxValues(1)));
    await i.showModal(modal);
  }
}
module.exports={handle};