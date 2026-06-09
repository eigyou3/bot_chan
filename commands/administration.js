const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const ALLOWED_USERS = ['1088369918069715024', '936419559165026304'];

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('管理用コマンド')
    .addSubcommand(sub =>
      sub.setName('announce')
        .setDescription('リアクション付きアナウンスを送信')
        .addStringOption(o => o.setName('text').setDescription('案内文章（\\nで改行）').setRequired(true))
        .addStringOption(o => o.setName('emoji').setDescription('リアクション絵文字').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('付与するロール').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('sticky')
        .setDescription('常駐アナウンスを設定')
        .addStringOption(o => o.setName('text').setDescription('常駐文章（\\nで改行）').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('alarm')
        .setDescription('指定時間後にアラームを設定')
        .addIntegerOption(o => o.setName('minutes').setDescription('何分後か').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('通知メッセージ').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setvc')
        .setDescription('VC参加の通知先チャンネルを設定')
        .addChannelOption(o => o.setName('channel').setDescription('通知先チャンネル').setRequired(true).addChannelTypes(ChannelType.GuildText))
    ),

  async execute(interaction, client) {
    if (!ALLOWED_USERS.includes(interaction.user.id)) {
      return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const config = loadConfig();

    // --- 1. 通常アナウンス ---
    if (subcommand === 'announce') {
      const text = interaction.options.getString('text').replace(/\\n/g, '\n');
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');

      const embed = new EmbedBuilder().setColor('#5865F2').setDescription(text);
      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      await msg.react(emoji);

      // リアクション追加イベント用のリスナー（簡易実装）
      client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot || reaction.message.id !== msg.id) return;
        if (reaction.emoji.name === emoji || reaction.emoji.id === emoji) {
          const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
          if (member) await member.roles.add(role).catch(() => null);
        }
      });
      return;
    }

    // --- 2. 常駐アナウンス ---
    if (subcommand === 'sticky') {
      const text = interaction.options.getString('text').replace(/\\n/g, '\n');
      const embed = new EmbedBuilder().setColor('#E67E22').setDescription(text);

      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

      if (!config.sticky) config.sticky = {};
      config.sticky[interaction.channelId] = { messageId: msg.id, text };
      saveConfig(config);

      if (!client.stickyMap) client.stickyMap = new Map();
      client.stickyMap.set(interaction.channelId, { messageId: msg.id, text });
      return;
    }

    // --- 3. アラーム設定 ---
    if (subcommand === 'alarm') {
      const minutes = interaction.options.getInteger('minutes');
      const message = interaction.options.getString('message');
      const targetTime = Date.now() + minutes * 60 * 1000;

      if (!config.alarms) config.alarms = [];
      const alarmData = { time: targetTime, channelId: interaction.channelId, message };
      config.alarms.push(alarmData);
      saveConfig(config);

      setTimeout(async () => {
        const channel = await client.channels.fetch(interaction.channelId).catch(() => null);
        if (channel) await channel.send(message);

        const currentConfig = loadConfig();
        currentConfig.alarms = (currentConfig.alarms || []).filter(a => a.time !== targetTime);
        saveConfig(currentConfig);
      }, minutes * 60 * 1000);

      return interaction.reply({ content: `⏰ ${minutes}分後にアラームを設定しました。`, ephemeral: true });
    }

    // --- 4. VC通知先設定 ---
    if (subcommand === 'setvc') {
      const channel = interaction.options.getChannel('channel');
      config.vcNotifyChannelId = channel.id;
      saveConfig(config);

      return interaction.reply({ content: `✅ VC参加の通知先を <#${channel.id}> に設定しました。`, ephemeral: true });
    }
  },
};