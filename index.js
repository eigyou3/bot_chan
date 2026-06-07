const http = require('http');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const {
  Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder,
  REST, Routes, SlashCommandBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  ChannelType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ==============================
// アナウンス実行者（追加・削除可能）
// ==============================
const ANNOUNCE_ALLOWED_USERS = [
  '1088369918069715024','936419559165026304'
];

// ==============================
// フォント登録（ウェルカム画像用）
// ==============================
const fontBase = require('path').join(__dirname, 'node_modules', '@fontsource', 'noto-sans-jp', 'files');
try {
  GlobalFonts.registerFromPath(require('path').join(fontBase, 'noto-sans-jp-japanese-900-normal.woff'), 'NotoSansJP-Black');
  GlobalFonts.registerFromPath(require('path').join(fontBase, 'noto-sans-jp-japanese-100-normal.woff'), 'NotoSansJP-Thin');
  console.log('✅ フォント読み込み成功');
} catch (e) {
  console.warn('⚠️ フォント読み込み失敗:', e.message);
}

// ==============================
// ウェルカム設定
// ==============================
const WELCOME_ALLOWED_GUILDS = [
  '1496054346385723472',
];
const WELCOME_NOTIFY_ROLE_ID = '1496147336043298866';
const WELCOME_BG_OPACITY = 0.15;
const DEFAULT_WELCOME_MESSAGE = 'ご来場お待ちしておりました。\n担当スタッフがすぐにご案内いたします。';

// ==============================
// チャンネル設定の保存・読み込み
// ==============================
const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// リアクション→ロールの一時保存（メッセージID: {emoji, roleId}）
const reactionRoleMap = new Map();

// 常駐アナウンスの保存（チャンネルID: {messageId, text, emoji, roleId}）
const stickyMap = new Map();

function loadSticky() {
  const config = loadConfig();
  if (!config.sticky) return;
  for (const [channelId, data] of Object.entries(config.sticky)) {
    stickyMap.set(channelId, data);
    if (data.roleId !== 'none') {
      reactionRoleMap.set(data.messageId, { emoji: data.emoji, roleId: data.roleId });
    }
  }
  console.log(`✅ 常駐アナウンス復元: ${stickyMap.size}件`);
}

function saveSticky() {
  const config = loadConfig();
  config.sticky = Object.fromEntries(stickyMap);
  saveConfig(config);
}

// ==============================
// アラーム管理
// ==============================
let alarmTimers = [];

function loadAlarm() {
  const config = loadConfig();
  return config.alarm || null;
}

function saveAlarm(data) {
  const config = loadConfig();
  config.alarm = data;
  saveConfig(config);
}

function clearAlarmTimers() {
  alarmTimers.forEach(t => clearTimeout(t));
  alarmTimers = [];
}

function scheduleAlarms(alarmData) {
  clearAlarmTimers();
  if (!alarmData) return;

  const { times, text, channelId } = alarmData;

  times.forEach(timeStr => {
    function scheduleNext() {
      const now = new Date();
      const [h, m] = timeStr.split(':').map(Number);
      // JSTをUTCに変換（JST = UTC+9）
      const utcH = (h - 9 + 24) % 24;
      const next = new Date();
      next.setUTCHours(utcH, m, 0, 0);
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
      const delay = next - now;

      const timer = setTimeout(async () => {
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel) {
            const embed = new EmbedBuilder()
              .setColor('#5865F2')
              .setDescription(text)
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch (e) {
          console.error('アラーム送信失敗:', e.message);
        }
        scheduleNext(); // 翌日も繰り返す
      }, delay);

      alarmTimers.push(timer);
      console.log(`⏰ アラーム設定: ${timeStr} (${Math.round(delay/1000/60)}分後)`);
    }
    scheduleNext();
  });
}

// ==============================
// Discord クライアント
// ==============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// ==============================
// スラッシュコマンド登録
// ==============================
client.once('ready', async () => {
  console.log(`✅ Bot起動: ${client.user.tag}`);
  loadSticky();

  // アラーム復元
  const alarmData = loadAlarm();
  if (alarmData) {
    scheduleAlarms(alarmData);
    console.log(`✅ アラーム復元: ${alarmData.times.join(', ')}`);
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('setchannel')
      .setDescription('VC通知を送るチャンネルを設定します')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('通知先チャンネル')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('announce')
      .setDescription('アナウンスを投稿します（常に最下部に常駐）')
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('絵文字を押した人につけるロール（省略可）')
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName('clearannounce')
      .setDescription('常駐アナウンスを解除・削除します'),
    new SlashCommandBuilder()
      .setName('setalarmchannel')
      .setDescription('アラーム通知先チャンネルを設定します')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('通知先チャンネル')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('alarm')
      .setDescription('アラームを設定します（最大3つ・毎日繰り返し）'),
    new SlashCommandBuilder()
      .setName('clearalarm')
      .setDescription('アラームをすべて解除します'),
    new SlashCommandBuilder()
      .setName('welcome')
      .setDescription('来場者ウェルカム画像を生成します'),
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('✅ スラッシュコマンド登録完了');
  } catch (e) {
    console.error('スラッシュコマンド登録失敗:', e);
  }
});

// ==============================
// インタラクション処理
// ==============================
client.on('interactionCreate', async (interaction) => {


  // /welcome → モーダル表示
  if (interaction.isChatInputCommand() && interaction.commandName === 'welcome') {
    const modal = new ModalBuilder()
      .setCustomId('welcome_modal')
      .setTitle('来場者情報を入力');

    // サーバー制限チェック
    if (!WELCOME_ALLOWED_GUILDS.includes(interaction.guildId)) {
      await interaction.reply({ content: '❌ このサーバーでは使用できません。', ephemeral: true });
      return;
    }

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('date')
          .setLabel('日付（例: 6/7）')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('月/日')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('guest1')
          .setLabel('来場者1　時間　お名前（例: 10:00 斉藤様）')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('時間 お名前')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('guest2')
          .setLabel('来場者2　時間　お名前（省略可）')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('時間 お名前')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('guest3')
          .setLabel('来場者3　時間　お名前（省略可）')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('時間 お名前')
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('welcome_msg')
          .setLabel('ウェルカムメッセージ（省略可）')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('ご来場お待ちしておりました。\n担当スタッフがすぐにご案内いたします。')
          .setRequired(false)
      ),
    );

    await interaction.showModal(modal);
    return;
  }

  // ウェルカムモーダル送信
  if (interaction.isModalSubmit() && interaction.customId === 'welcome_modal') {
    await interaction.deferReply();

    const dateRaw = interaction.fields.getTextInputValue('date').trim();
    const raw1 = interaction.fields.getTextInputValue('guest1').trim();
    const raw2 = interaction.fields.getTextInputValue('guest2').trim();
    const raw3 = interaction.fields.getTextInputValue('guest3').trim();
    const msgInput = interaction.fields.getTextInputValue('welcome_msg').trim();
    const welcomeMessage = msgInput || DEFAULT_WELCOME_MESSAGE;

    const date = parseDate(dateRaw);
    if (!date) {
      await interaction.editReply('⚠️ 日付を正しく入力してください。例: `6/7`');
      return;
    }

    const guests = [];
    for (const raw of [raw1, raw2, raw3]) {
      if (!raw) continue;
      const parsed = parseTimeAndName(raw);
      if (parsed) guests.push({ date, ...parsed });
    }

    // 時間順に並べ替え（早い順）
    guests.sort((a, b) => a.time.localeCompare(b.time));

    if (guests.length === 0) {
      await interaction.editReply('⚠️ 来場者情報を正しく入力してください。例: `10:00 斉藤様`');
      return;
    }

    try {
      const buffer = await generateWelcomeImage({ guests, welcomeMessage }, 1920, 1080);
      const file = new AttachmentBuilder(buffer, { name: 'welcome.jpg' });
      const member = interaction.member;
      const roleColor = member?.roles?.color?.hexColor ?? '#808080';
      const names = guests.map(g => g.name).join('・');

      const embed = new EmbedBuilder()
        .setColor(roleColor)
        .setDescription(
          `<@${interaction.user.id}> !\n` +
          `${names}のウェルカムを作成したよ！\n\n` +
          `<@&${WELCOME_NOTIFY_ROLE_ID}> みんなにも共有しておくね！`
        )
        .setImage('attachment://welcome.jpg');

      await interaction.editReply({ embeds: [embed], files: [file] });
    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ 画像生成中にエラーが発生しました');
    }
    return;
  }

  // /setchannel
  if (interaction.isChatInputCommand() && interaction.commandName === 'setchannel') {
    const channel = interaction.options.getChannel('channel');
    const config = loadConfig();
    config.vcNotifyChannelId = channel.id;
    saveConfig(config);
    await interaction.reply({
      content: `✅ VC通知チャンネルを <#${channel.id}> に設定しました！`,
      ephemeral: true
    });
    return;
  }

  // /announce
  if (interaction.isChatInputCommand() && interaction.commandName === 'announce') {
    const hasPermission = ANNOUNCE_ALLOWED_USERS.includes(interaction.user.id);
    if (!hasPermission) {
      await interaction.reply({ content: '❌ このコマンドを使用する権限がありません。', ephemeral: true });
      return;
    }

    const roleOption = interaction.options.getRole('role');

    const modal = new ModalBuilder()
      .setCustomId(`announce_modal:${roleOption?.id ?? 'none'}`)
      .setTitle('アナウンス作成');

    const textInput = new TextInputBuilder()
      .setCustomId('announce_text')
      .setLabel('発信したいテキスト')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const emojiInput = new TextInputBuilder()
      .setCustomId('announce_emoji')
      .setLabel('投稿につけたい絵文字（省略可）')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(textInput),
      new ActionRowBuilder().addComponents(emojiInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // /clearannounce
  if (interaction.isChatInputCommand() && interaction.commandName === 'clearannounce') {
    const hasPermission = ANNOUNCE_ALLOWED_USERS.includes(interaction.user.id);
    if (!hasPermission) {
      await interaction.reply({ content: '❌ このコマンドを使用する権限がありません。', ephemeral: true });
      return;
    }

    const channelId = interaction.channelId;
    const sticky = stickyMap.get(channelId);

    if (!sticky) {
      await interaction.reply({ content: '⚠️ このチャンネルに常駐アナウンスはありません。', ephemeral: true });
      return;
    }

    // 古いメッセージを削除
    try {
      const oldMsg = await interaction.channel.messages.fetch(sticky.messageId);
      await oldMsg.delete();
    } catch (e) {
      console.warn('常駐メッセージ削除失敗:', e.message);
    }

    stickyMap.delete(channelId);
    reactionRoleMap.delete(sticky.messageId);
    saveSticky();

    await interaction.reply({ content: '✅ 常駐アナウンスを解除しました。', ephemeral: true });
    return;
  }

  // /clearalarm
  if (interaction.isChatInputCommand() && interaction.commandName === 'clearalarm') {
    const hasPermission = ANNOUNCE_ALLOWED_USERS.includes(interaction.user.id);
    if (!hasPermission) {
      await interaction.reply({ content: '❌ このコマンドを使用する権限がありません。', ephemeral: true });
      return;
    }

    clearAlarmTimers();
    saveAlarm(null);

    await interaction.reply({ content: '✅ アラームをすべて解除しました。', ephemeral: true });
    return;
  }

  // /setalarmchannel
  if (interaction.isChatInputCommand() && interaction.commandName === 'setalarmchannel') {
    const hasPermission = ANNOUNCE_ALLOWED_USERS.includes(interaction.user.id);
    if (!hasPermission) {
      await interaction.reply({ content: '❌ このコマンドを使用する権限がありません。', ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel('channel');
    const config = loadConfig();
    config.alarmChannelId = channel.id;
    saveConfig(config);
    await interaction.reply({
      content: `✅ アラームチャンネルを <#${channel.id}> に設定しました！`,
      ephemeral: true
    });
    return;
  }

  // /alarm
  if (interaction.isChatInputCommand() && interaction.commandName === 'alarm') {
    const hasPermission = ANNOUNCE_ALLOWED_USERS.includes(interaction.user.id);
    if (!hasPermission) {
      await interaction.reply({ content: '❌ このコマンドを使用する権限がありません。', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('alarm_modal')
      .setTitle('アラーム設定');

    const textInput = new TextInputBuilder()
      .setCustomId('alarm_text')
      .setLabel('通知テキスト（全アラーム共通）')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const time1Input = new TextInputBuilder()
      .setCustomId('alarm_time1')
      .setLabel('時間1（例: 09:00）')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const time2Input = new TextInputBuilder()
      .setCustomId('alarm_time2')
      .setLabel('時間2（省略可）')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const time3Input = new TextInputBuilder()
      .setCustomId('alarm_time3')
      .setLabel('時間3（省略可）')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(time1Input),
      new ActionRowBuilder().addComponents(time2Input),
      new ActionRowBuilder().addComponents(time3Input),
      new ActionRowBuilder().addComponents(textInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // アラームモーダル送信
  if (interaction.isModalSubmit() && interaction.customId === 'alarm_modal') {
    const text = interaction.fields.getTextInputValue('alarm_text').trim();
    const t1 = interaction.fields.getTextInputValue('alarm_time1').trim();
    const t2 = interaction.fields.getTextInputValue('alarm_time2').trim();
    const t3 = interaction.fields.getTextInputValue('alarm_time3').trim();

    const times = [t1, t2, t3].filter(t => t && /^\d{1,2}:\d{2}$/.test(t));

    if (times.length === 0) {
      await interaction.reply({ content: '❌ 有効な時間が入力されていません。例: 09:00', ephemeral: true });
      return;
    }

    const config = loadConfig();
    if (!config.alarmChannelId) {
      await interaction.reply({ content: '❌ 先に /setalarmchannel でチャンネルを設定してください。', ephemeral: true });
      return;
    }

    const alarmData = { times, text, channelId: config.alarmChannelId };
    saveAlarm(alarmData);
    scheduleAlarms(alarmData);

    await interaction.reply({
      content: `✅ アラームを設定しました！
⏰ ${times.join(' / ')} に毎日通知します。`,
      ephemeral: true
    });
    return;
  }

  // モーダル送信
  if (interaction.isModalSubmit() && interaction.customId.startsWith('announce_modal:')) {
    const roleId = interaction.customId.split(':')[1];
    const text = interaction.fields.getTextInputValue('announce_text');
    const emoji = interaction.fields.getTextInputValue('announce_emoji').trim();
    const cleanEmoji = emoji.replace(/\uFE0F/g, '').trim();

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(text);

    await interaction.reply({ content: '✅ 投稿しました！', ephemeral: true });

    // 既存の常駐アナウンスがあれば削除
    const channelId = interaction.channelId;
    const existing = stickyMap.get(channelId);
    if (existing) {
      try {
        const oldMsg = await interaction.channel.messages.fetch(existing.messageId);
        await oldMsg.delete();
      } catch (e) {
        console.warn('既存アナウンス削除失敗:', e.message);
      }
      reactionRoleMap.delete(existing.messageId);
    }

    const posted = await interaction.channel.send({ embeds: [embed] });

    // Botがリアクションを押す
    if (cleanEmoji) {
      try {
        await posted.react(cleanEmoji);
      } catch (e) {
        console.warn('絵文字のリアクション失敗:', e.message);
        console.warn('入力された絵文字:', [...emoji].map(c => c.codePointAt(0).toString(16)).join(' '));
      }
    }

    // 常駐情報を保存
    stickyMap.set(channelId, { messageId: posted.id, text, emoji: cleanEmoji, roleId });
    saveSticky();

    // ロールが指定されていれば記録
    if (roleId !== 'none') {
      reactionRoleMap.set(posted.id, { emoji: cleanEmoji, roleId });
    }

    return;
  }
});

// ==============================
// 常駐アナウンス（新メッセージが来たら再投稿）
// ==============================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const channelId = message.channelId;
  const sticky = stickyMap.get(channelId);
  if (!sticky) return;

  // 古いメッセージを削除
  try {
    const oldMsg = await message.channel.messages.fetch(sticky.messageId);
    await oldMsg.delete();
  } catch (e) {
    console.warn('古い常駐メッセージ削除失敗:', e.message);
  }

  // 再投稿
  const reEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setDescription(sticky.text);
  const posted = await message.channel.send({ embeds: [reEmbed] });

  // リアクションを押す
  if (sticky.emoji) {
    try {
      await posted.react(sticky.emoji);
    } catch (e) {
      console.warn('再投稿リアクション失敗:', e.message);
    }
  }

  // reactionRoleMapを更新
  if (sticky.roleId !== 'none') {
    reactionRoleMap.delete(sticky.messageId);
    reactionRoleMap.set(posted.id, { emoji: sticky.emoji, roleId: sticky.roleId });
  }

  // stickyMapのmessageIdを更新
  stickyMap.set(channelId, { ...sticky, messageId: posted.id });
  saveSticky();
});

// ==============================
// リアクションでロール付与
// ==============================
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (!reactionRoleMap.has(reaction.message.id)) return;

  const { emoji, roleId } = reactionRoleMap.get(reaction.message.id);

  const reactionEmoji = reaction.emoji.id
    ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
    : reaction.emoji.name;

  const cleanReaction = reactionEmoji.replace(/\uFE0F/g, '').trim();
  if (cleanReaction !== emoji) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    await member.roles.add(roleId);
    console.log(`✅ ロール付与: ${user.tag}`);
  } catch (e) {
    console.error('ロール付与失敗:', e.message);
  }
});

// ==============================
// VC参加検知（0人→1人のみ）
// ==============================
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!newState.channelId) return;
  if (oldState.channelId === newState.channelId) return;

  const vcChannel = newState.channel;
  if (!vcChannel || vcChannel.members.size !== 1) return;

  const config = loadConfig();
  if (!config.vcNotifyChannelId) return;

  const notifyChannel = newState.guild.channels.cache.get(config.vcNotifyChannelId);
  if (!notifyChannel) return;

  const member = newState.member;
  const roleColor = member?.roles?.color?.hexColor ?? '#5865F2';

  const embed = new EmbedBuilder()
    .setColor(roleColor)
    .setAuthor({
      name: member.displayName,
      iconURL: member.user.displayAvatarURL({ dynamic: true }),
    })
    .setDescription(`<@${member.id}> が通話を始めました！\n気軽に参加してね！`)
    .setTimestamp();

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const vcRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('通話に参加する')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${newState.guild.id}/${newState.channelId}`)
  );

  await notifyChannel.send({ embeds: [embed], components: [vcRow] });
});


// ==============================
// ウェルカム画像テキストパース
// ==============================
function parseDate(text) {
  const normalized = text
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[／]/g, '/').replace(/[：]/g, ':').replace(/　/g, ' ').trim();
  const m = normalized.match(/(\d{1,2})[\/月](\d{1,2})(?:日)?/);
  if (!m) return null;
  return `${parseInt(m[1])}/${parseInt(m[2])}`;
}

function parseTimeAndName(text) {
  const normalized = text
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[：]/g, ':').replace(/　/g, ' ').trim();
  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})|(\d{1,2})時(\d{2})?(?:分)?/);
  const nameMatch = normalized.match(/([^\s\d:/時分]+(?:様|さん))/);
  if (!nameMatch) return null;
  let hour = '00', minute = '00';
  if (timeMatch) {
    if (timeMatch[1] !== undefined) {
      hour = timeMatch[1].padStart(2, '0');
      minute = timeMatch[2].padStart(2, '0');
    } else {
      hour = timeMatch[3].padStart(2, '0');
      minute = (timeMatch[4] || '00').padStart(2, '0');
    }
  }
  return { time: `${hour}:${minute}`, name: nameMatch[1] };
}

function parseGuest(text) {
  const normalized = text
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[／]/g, '/')
    .replace(/[：]/g, ':')
    .replace(/　/g, ' ')
    .trim();

  const dateMatch = normalized.match(/(\d{1,2})[\/月](\d{1,2})(?:日)?/);
  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})|(\d{1,2})時(\d{2})?(?:分)?/);
  const nameMatch = normalized.match(/([^\s\d:/月日時分]+(?:様|さん))/);

  if (!dateMatch || !nameMatch) return null;

  const month = parseInt(dateMatch[1]);
  const day   = parseInt(dateMatch[2]);
  let hour = '00', minute = '00';

  if (timeMatch) {
    if (timeMatch[1] !== undefined) {
      hour   = timeMatch[1].padStart(2, '0');
      minute = timeMatch[2].padStart(2, '0');
    } else {
      hour   = timeMatch[3].padStart(2, '0');
      minute = (timeMatch[4] || '00').padStart(2, '0');
    }
  }

  return { date: `${month}/${day}`, time: `${hour}:${minute}`, name: nameMatch[1] };
}

// ==============================
// ウェルカム画像生成
// ==============================
async function generateWelcomeImage({ guests, welcomeMessage }, W = 1920, H = 1080) {
  const SCALE = 2;
  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.antialias = 'subpixel';
  ctx.patternQuality = 'best';
  ctx.quality = 'best';
  ctx.textDrawingMode = 'path';

  const BLACK = 'NotoSansJP-Black';
  const THIN  = 'NotoSansJP-Thin';
  const pt = v => Math.round(v * 96 / 72);
  const cx = Math.round(W / 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(Math.round(W*0.021), Math.round(H*0.037), Math.round(W*0.958), Math.round(H*0.926));

  ctx.strokeStyle = '#E8E8E8';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(W*0.029), Math.round(H*0.052), Math.round(W*0.942), Math.round(H*0.896));

  try {
    const bgImg = await loadImage(require('path').join(__dirname, 'bg.png'));
    ctx.globalAlpha = WELCOME_BG_OPACITY;
    ctx.drawImage(bgImg, 0, 0, W, H);
    ctx.globalAlpha = 1.0;
  } catch (e) {
    console.warn('bg.png読み込みスキップ:', e.message);
  }

  ctx.textAlign = 'center';
  ctx.font = `900 ${pt(80)}px "${BLACK}"`;
  ctx.fillStyle = 'rgba(64,64,64,0.50)';
  ctx.fillText('Welcome', cx + 6, 280);
  ctx.fillText('Welcome', cx, 280);

  const guestCount = guests.length;

  // 共通日付（最初のゲストの日付）
  const sharedDate = guests[0].date;

  // 日付を上部に表示
  ctx.font = `100 ${pt(26)}px "${THIN}"`;
  ctx.fillStyle = '#606060';
  ctx.fillText(sharedDate, cx, 340);

  if (guestCount === 1) {
    // 1組：中央
    ctx.font = `100 ${pt(28)}px "${THIN}"`;
    ctx.fillStyle = '#606060';
    ctx.fillText(guests[0].time, cx, 420);
    ctx.font = `100 ${pt(56)}px "${THIN}"`;
    ctx.fillStyle = '#404040';
    ctx.fillText(guests[0].name, cx, 510);

  } else if (guestCount === 2) {
    // 2組：左右
    const col1 = Math.round(W * 0.28);
    const col2 = Math.round(W * 0.72);
    ctx.fillStyle = '#606060';
    ctx.font = `100 ${pt(24)}px "${THIN}"`;
    ctx.fillText(guests[0].time, col1, 420);
    ctx.font = `100 ${pt(44)}px "${THIN}"`;
    ctx.fillStyle = '#404040';
    ctx.fillText(guests[0].name, col1, 500);
    ctx.font = `100 ${pt(24)}px "${THIN}"`;
    ctx.fillStyle = '#606060';
    ctx.fillText(guests[1].time, col2, 420);
    ctx.font = `100 ${pt(44)}px "${THIN}"`;
    ctx.fillStyle = '#404040';
    ctx.fillText(guests[1].name, col2, 500);
    // 縦線
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 380);
    ctx.lineTo(cx, 530);
    ctx.stroke();

  } else {
    // 3組：3分割
    const col1 = Math.round(W * 0.2);
    const col2 = cx;
    const col3 = Math.round(W * 0.8);
    const cols = [col1, col2, col3];
    guests.forEach((g, i) => {
      ctx.font = `100 ${pt(22)}px "${THIN}"`;
      ctx.fillStyle = '#606060';
      ctx.fillText(g.time, cols[i], 420);
      ctx.font = `100 ${pt(38)}px "${THIN}"`;
      ctx.fillStyle = '#404040';
      ctx.fillText(g.name, cols[i], 500);
    });
    // 縦線2本
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    [Math.round(W*0.4), Math.round(W*0.6)].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 380);
      ctx.lineTo(x, 530);
      ctx.stroke();
    });
  }

  // ウェルカムメッセージ（下部固定）
  const msgY = 840;
  ctx.font = `100 ${pt(22)}px "${THIN}"`;
  ctx.fillStyle = '#404040';
  const lines = welcomeMessage.split('\n');
  const lineH = pt(16) * 1.9;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, msgY + i * lineH);
  });

  return canvas.toBuffer('image/jpeg', { quality: 1.0 });
}

// ダミーHTTPサーバー（Render無料枠用）
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
}).listen(PORT, () => {
  console.log(`✅ HTTPサーバー起動: port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
