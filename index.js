const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

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

// ==============================
// Discord クライアント
// ==============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ==============================
// スラッシュコマンド登録
// ==============================
client.once('ready', async () => {
  console.log(`✅ Bot起動: ${client.user.tag}`);

  const command = new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('VC通知を送るチャンネルを設定します')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('通知先チャンネル')
        .setRequired(true)
    );

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: [command.toJSON()] }
    );
    console.log('✅ スラッシュコマンド登録完了');
  } catch (e) {
    console.error('スラッシュコマンド登録失敗:', e);
  }
});

// ==============================
// /setchannel コマンド処理
// ==============================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'setchannel') return;

  const channel = interaction.options.getChannel('channel');
  const config = loadConfig();
  config.vcNotifyChannelId = channel.id;
  saveConfig(config);

  await interaction.reply({
    content: `✅ VC通知チャンネルを <#${channel.id}> に設定しました！`,
    ephemeral: true
  });
});

// ==============================
// VC参加検知（0人→1人のみ）
// ==============================
client.on('voiceStateUpdate', async (oldState, newState) => {
  // VCに参加した場合のみ（退出・移動は無視）
  if (!newState.channelId) return;
  if (oldState.channelId === newState.channelId) return;

  // 参加後のVCのメンバー数が1人のときだけ（= 自分が最初）
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
    .setDescription(
      `<@${member.id}> が通話を始めました！\n気軽に参加してね！`
    )
    .setTimestamp();

  await notifyChannel.send({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);
