const {
  Client, GatewayIntentBits, EmbedBuilder,
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
  '1088369918069715024',
];

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

  await notifyChannel.send({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);
