const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');
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
        .setDescription('アナウンスを送信（文章はポップアップで入力）')
        .addRoleOption(o => o.setName('role').setDescription('付与・解除させたいロール（空欄ならボタンなし）').setRequired(false))
        .addBooleanOption(o => o.setName('sticky').setDescription('最下行に常駐（固定）させるか（デフォルト: いいえ）').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('alarm')
        .setDescription('毎日繰り返すアラームを設定（複数指定はスペース区切り）')
        .addStringOption(o => o.setName('times').setDescription('時刻（例: 15:30 21:00）').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('通知メッセージ').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setvc')
        .setDescription('このチャンネルをVC参加の通知先に設定します')
    ),

  async execute(interaction, client) {
    if (!ALLOWED_USERS.includes(interaction.user.id)) {
      return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const config = loadConfig();

    if (subcommand === 'announce') {
      const role = interaction.options.getRole('role');
      const isSticky = interaction.options.getBoolean('sticky') || false;
      
      const roleIdParam = role ? role.id : 'none';
      const stickyParam = isSticky ? '1' : '0';

      const modal = new ModalBuilder()
        .setCustomId(`ann_mdl_${roleIdParam}_${stickyParam}`)
        .setTitle('アナウンス内容の入力');

      const textInput = new TextInputBuilder()
        .setCustomId('announce_text')
        .setLabel('案内文章（ここで普通に改行できます）')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(textInput));

      return await interaction.showModal(modal);
    }

    if (subcommand === 'alarm') {
      const timesInput = interaction.options.getString('times');
      const message = interaction.options.getString('message');
      
      const timeInputs = timesInput.split(/[\s ]+/).filter(Boolean);
      const registeredTimes = [];

      if (!config.alarms) config.alarms = [];

      for (const timeStr of timeInputs) {
        // 時刻形式（HH:MM）の簡易チェック
        const match = timeStr.trim().match(/^([0-2]?\d):([0-5]\d)$/);
        if (!match) continue;

        // 時と分を綺麗にフォーマット（例: 5:3 -> 05:03）
        const hours = parseInt(match[1], 10).toString().padStart(2, '0');
        const minutes = parseInt(match[2], 10).toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}`;

        // 重複登録を避ける
        const exists = config.alarms.some(a => a.time === formattedTime && a.channelId === interaction.channelId && a.message === message);
        if (!exists) {
          config.alarms.push({
            time: formattedTime,
            channelId: interaction.channelId,
            message: message
          });
        }
        registeredTimes.push(formattedTime);
      }

      if (registeredTimes.length === 0) {
        return interaction.reply({ content: '❌ 時刻の形式が正しくありません。「15:30」や「21:00」のように入力してください。', ephemeral: true });
      }

      saveConfig(config);

      return interaction.reply({ 
        content: `⏰ 以下の時刻に毎日繰り返すアラームを設定しました。\n設定時刻: ${registeredTimes.map(t => `**${t}**`).join(', ')}`, 
        ephemeral: true 
      });
    }

    if (subcommand === 'setvc') {
      if (!client.vcNotifyMap) client.vcNotifyMap = new Map();
      client.vcNotifyMap.set(interaction.guildId, interaction.channelId);
      return interaction.reply({ content: `✅ VC参加の通知先をこのサーバーのこのチャンネル（ <#${interaction.channelId}> ）に設定しました。`, ephemeral: true });
    }
  },
};
