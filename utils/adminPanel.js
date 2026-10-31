const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits: P, MessageFlags } = require('discord.js');
const st = require('./store');
const { syncGuild } = require('./registerCommands');

const PREFIX = 'cfg_';
const isAdmin = i => i.user.id === i.guild.ownerId || i.memberPermissions?.has(P.Administrator) || i.user.id === '1088369918069715024';
const allowed = i => i.guild && st.findCh(i.guild)?.id === i.channelId && isAdmin(i);
const btn = (id,label,style=ButtonStyle.Secondary,disabled=false) => new ButtonBuilder().setCustomId(PREFIX+id).setLabel(label).setStyle(style).setDisabled(disabled);
const row = (...buttons) => new ActionRowBuilder().addComponents(...buttons);
const logData = guild => {
  const d = st.get(guild.id);
  if (!Array.isArray(d.adminLogs)) d.adminLogs = [];
  return d.adminLogs;
};
const panel = guild => {
  const gi = st.get(guild.id).genshin === true || require('./gi').GI.includes(guild.id);
  return {
    embeds:[new EmbedBuilder().setColor('#5865F2').setTitle('⚙️ Bot 管理パネル')
      .setDescription([
        'Botの導入ありがとうございます。ここは管理者向けの非公開設定チャンネルです。',
        '設定内容や操作履歴はこのチャンネルで管理します。削除・改名しないでください。',
        '',
        '📢 サーバー名・所有者情報などはBot制作者へ導入時に通知されます。取得可能な既存招待リンクを通知する場合があります。',
        '💬 詳細な説明をご希望の場合は、Bot制作者 <@1088369918069715024>（ID: \`1088369918069715024\`）をサーバーに招待してください。',
        '',
        `**原神専用機能：${gi ? '有効 ✅' : '未登録'}**`,
        '機能の一覧や使い方は \`/help\` で確認できます。',
        '',
        '⚠️ パネル初期化はサーバー所有者だけが実行できます。'
      ].join('\n'))],
    components:[
      row(btn('genshin','原神サーバーに登録',ButtonStyle.Success,gi),btn('refresh','表示を更新')),
      row(btn('reset','管理パネルを初期化',ButtonStyle.Danger))
    ],
    allowedMentions:{parse:[]}
  };
};
const logsPage = (guild,page=0) => {
  const logs=logData(guild);
  const pages=Math.max(1,Math.ceil(logs.length/10));
  const p=Math.max(0,Math.min(page,pages-1));
  const items=logs.slice(p*10,p*10+10);
  const description=items.length ? items.map(entry=>`<t:${entry.at}:f>  <@${entry.by}> (\`${entry.by}\`)\n${entry.action}`).join('\n\n') : 'まだ管理操作はありません。';
  return {embeds:[new EmbedBuilder().setColor('#64748B').setTitle('📋 Bot 管理ログ')
    .setDescription(description).setFooter({text:`${p+1} / ${pages} ページ・全${logs.length}件`})],
    components:[row(btn(`log_${p-1}`,'前のページ',ButtonStyle.Secondary,p===0),btn(`log_${p+1}`,'次のページ',ButtonStyle.Secondary,p>=pages-1))],allowedMentions:{parse:[]}};
};
async function ensureMessages(guild){
  const ch=st.findCh(guild);
  if(!ch) throw new Error('#bot-config が見つかりません');
  const d=st.get(guild.id);
  for(const [key,render] of [['panelMessageId',()=>panel(guild)],['logMessageId',()=>logsPage(guild)]]){
    let msg=d[key] && await ch.messages.fetch(d[key]).catch(()=>null);
    if(!msg){
      // Reuse existing bot panel if its ID was lost from saved config.
      const recent=await ch.messages.fetch({limit:30}).catch(()=>null);
      msg=recent?.find(m=>m.author.id===guild.client.user.id && m.embeds[0]?.title === (key==='panelMessageId'?'⚙️ Bot 管理パネル':'📋 Bot 管理ログ'));
    }
    if(msg) await msg.edit(render());
    else msg=await ch.send(render());
    d[key]=msg.id;
  }
  await st.save(guild);
  // Remove only the obsolete standalone welcome embeds posted by this Bot.
  // Do not touch messages posted by administrators or other applications.
  const recent = await ch.messages.fetch({limit:30}).catch(()=>null);
  for(const message of recent?.values?.() || []){
    if(message.author.id===guild.client.user.id && message.embeds[0]?.title==='🤖 Botの導入ありがとうございます!') {
      await message.delete().catch(()=>null);
    }
    if(message.author.id===guild.client.user.id && message.embeds[0]?.title==='🤖 Botの導入ありがとうございます！') {
      await message.delete().catch(()=>null);
    }
  }
}
async function append(guild,by,action){
  const list=logData(guild);
  list.unshift({at:Math.floor(Date.now()/1000),by,action});
  if(list.length>500) list.length=500;
  await st.save(guild);
  const ch=st.findCh(guild);
  const id=st.get(guild.id).logMessageId;
  const message=id && await ch?.messages.fetch(id).catch(()=>null);
  if(message) await message.edit(logsPage(guild));
}
async function handle(i,client){
  if(!i.isButton() || !i.customId.startsWith(PREFIX)) return false;
  if(!allowed(i)) {await i.reply({content:'この操作は #bot-config のサーバー管理者専用です。',flags:MessageFlags.Ephemeral});return true;}
  const id=i.customId.slice(PREFIX.length);
  if(id==='refresh'){await i.update(panel(i.guild));return true;}
  if(id.startsWith('log_')){await i.update(logsPage(i.guild,Number(id.slice(4))||0));return true;}
  if(id==='genshin'){
    if(require('./gi').isGI(i.guildId)){await i.reply({content:'原神機能はすでに有効です。',flags:MessageFlags.Ephemeral});return true;}
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const d=st.get(i.guildId);d.genshin=true;
    if(!await st.save(i.guild)){d.genshin=false;await i.editReply('設定の保存に失敗しました。');return true;}
    try{await syncGuild(client,i.guildId);}catch(e){console.error('原神コマンド登録失敗:',e);}
    await append(i.guild,i.user.id,'原神専用機能を有効化');
    await i.message.edit(panel(i.guild));
    await i.editReply('✅ 原神機能を有効化しました。');return true;
  }
  if(id==='reset'){
    if(i.user.id!==i.guild.ownerId){await i.reply({content:'初期化はサーバー所有者だけが実行できます。',flags:MessageFlags.Ephemeral});return true;}
    await i.reply({content:'⚠️ **確認 1/2** 管理パネルの表示と管理ログを初期化します。Botの各機能設定や原神登録は維持します。',components:[row(btn(`reset1_${i.user.id}`,'初期化へ進む',ButtonStyle.Danger),btn('cancel','キャンセル'))],flags:MessageFlags.Ephemeral});return true;
  }
  if(id==='cancel'){await i.update({content:'キャンセルしました。',components:[]});return true;}
  if(id.startsWith('reset1_') || id.startsWith('reset2_')){
    const [stage,uid]=id.split('_');
    if(i.user.id!==i.guild.ownerId||i.user.id!==uid){await i.reply({content:'サーバー所有者本人のみ操作できます。',flags:MessageFlags.Ephemeral});return true;}
    if(stage==='reset1'){
      await i.update({content:'🚨 **最終確認 2/2** 管理ログを消去し、管理パネルとログ表示を初期状態に戻します。この操作は取り消せません。',components:[row(btn(`reset2_${uid}`,'初期化を実行',ButtonStyle.Danger),btn('cancel','キャンセル'))]});return true;
    }
    st.get(i.guildId).adminLogs=[];
    await st.save(i.guild);
    const ch=st.findCh(i.guild);
    for(const [key,data] of [['panelMessageId',panel(i.guild)],['logMessageId',logsPage(i.guild)]]){
      const msg=await ch.messages.fetch(st.get(i.guildId)[key]).catch(()=>null);
      if(msg)await msg.edit(data);
    }
    await append(i.guild,i.user.id,'管理パネルと管理ログを初期化');
    await i.update({content:'✅ 管理パネルを初期化しました。各機能の設定は維持しています。',components:[]});return true;
  }
  await i.reply({content:'無効な管理パネル操作です。',flags:MessageFlags.Ephemeral});return true;
}
module.exports={ensureMessages,handle,panel,logsPage,append};
