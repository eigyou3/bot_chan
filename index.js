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
const ANNOUNCE_ALLOWED_ROLES = [
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

// リアクション→ロールの一時保存（メッセージID: roleId）
const reactionRoleMap = new Map();

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
  ],
});

// ==============================
// スラッシュコマンド登録
// ==============================
client.once('ready', async () => {
  console.log(`✅ Bot起動: ${client.user.tag}`);

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
      .setDescription('アナウンスを投稿します')
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('絵文字を押した人につけるロール（省略可）')
          .setRequired(false)
      ),
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
    // 権限チェック
    const hasRole = interaction.member.roles.cache.some(r => ANNOUNCE_ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      await interaction.reply({ content: '❌ このコマンドを使用する権限がありません。', ephemeral: true });
      return;
    }

    const roleOption = interaction.options.getRole('role');

    // モーダル表示
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
      .setLabel('投稿につけたい絵文字（例: ✅ 👍）')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(textInput),
      new ActionRowBuilder().addComponents(emojiInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // モーダル送信
  if (interaction.isModalSubmit() && interaction.customId.startsWith('announce_modal:')) {
    const roleId = interaction.customId.split(':')[1];
    const text = interaction.fields.getTextInputValue('announce_text');
    const emoji = interaction.fields.getTextInputValue('announce_emoji').trim();

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(text);

    // ephemeralで完了通知（誰が実行したか見えない）
    await interaction.reply({ content: '✅ 投稿しました！', ephemeral: true });

    // 同チャンネルに投稿
    const posted = await interaction.channel.send({ embeds: [embed] });

    // Botがリアクションを押す
    try {
      await posted.react(emoji);
    } catch (e) {
      console.warn('絵文字のリアクション失敗:', e.message);
    }

    // ロールが指定されていれば記録
    if (roleId !== 'none') {
      reactionRoleMap.set(posted.id, { emoji, roleId });
    }

    return;
  }
});

// ==============================
// リアクションでロール付与
// ==============================
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (!reactionRoleMap.has(reaction.message.id)) return;

  const { emoji, roleId } = reactionRoleMap.get(reaction.message.id);

  // 絵文字が一致するか確認
  const reactionEmoji = reaction.emoji.id
    ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
    : reaction.emoji.name;

  if (reactionEmoji !== emoji && reaction.emoji.name !== emoji) return;

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
