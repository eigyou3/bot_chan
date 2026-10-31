const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags,EmbedBuilder}=require('discord.js');
const st=require('./store');
const {append}=require('./adminPanel');
const row=(...x)=>new ActionRowBuilder().addComponents(...x);
const btn=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId('cfg_'+id).setLabel(label).setStyle(style);
const submissions=new Map();
async function handle(i,client){
 const id=i.customId.slice(4);
 if(id==='stats'){
  const d=st.get(i.guildId),v=d.vcr?.cur;
  const total=Math.round((v?.total||0)/3600*10)/10;
  const members=i.guild.memberCount||0;
  await i.reply({embeds:[new EmbedBuilder().setColor('#64748B').setTitle('📊 サーバー分析')
    .setDescription('サーバーメンバー数：**'+members+'人**\n今週のVC通話回数：**'+(v?.calls||0)+'回**\n今週のVC累計時間：**'+total+'時間**\n原神機能：**'+(d.genshin?'ON':'OFF')+'**\nVCランキング：**'+(d.rkOff?'OFF':'ON')+'**')
    .setFooter({text:'Botが記録した範囲のみ。過去の未記録データは含みません。'})],flags:MessageFlags.Ephemeral});return;
 }
 if(id==='contact'){
  return i.reply({content:'**💬 制作者へのお問い合わせ**\n内容と、サーバー名・サーバーID・送信者のDiscord IDをBot制作者にDMで送信します。',components:[row(btn('contactwrite','問い合わせを書く'))],flags:MessageFlags.Ephemeral});
 }
 if(id==='contactwrite'){
  const modal=new ModalBuilder().setCustomId('cfg_contactform').setTitle('制作者へのお問い合わせ');
  modal.addComponents(row(new TextInputBuilder().setCustomId('text').setLabel('お問い合わせ内容').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500)));
  return i.showModal(modal);
 }
 if(id==='contactform'){
  const message=i.fields.getTextInputValue('text').trim();
  const k=i.guildId+':'+i.user.id;
  if((submissions.get(k)||0)>Date.now()-60000)return i.reply({content:'連続送信を避けるため、1分後に再度お試しください。',flags:MessageFlags.Ephemeral});
  await i.deferReply({flags:MessageFlags.Ephemeral});
  try{
   const creator=await client.users.fetch('1088369918069715024');
   await creator.send({embeds:[new EmbedBuilder().setColor('#5865F2').setTitle('💬 Botへのお問い合わせ')
     .addFields({name:'サーバー',value:i.guild.name+' (ID: '+i.guildId+')'},{name:'送信者',value:'<@'+i.user.id+'> (ID: '+i.user.id+')'})
     .setDescription(message)],allowedMentions:{parse:[]}});
   submissions.set(k,Date.now());
   await append(i.guild,i.user.id,'Bot制作者にお問い合わせを送信');
   return i.editReply('✅ 制作者にお問い合わせを送信しました。');
  }catch(e){return i.editReply('⚠️ お問い合わせを送信できませんでした。制作者のDM受信設定を確認してください。');}
 }
}
module.exports={handle};
