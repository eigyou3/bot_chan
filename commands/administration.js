const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ChannelType, 
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

// 時刻文字列（"HH:MM"）を本日のミリ秒に変換するヘルパー
function parseTimeToMs(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^([0-2]?\d):([0-5]\d)$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  const now = new Date();
  const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  
  const target = new Date(jstNow);
  target.setHours(hours, minutes, 0, 0);

  if (target.getTime() <= jstNow.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const diffMs = target.getTime() - jstNow.getTime();
  return Date.now() + diffMs;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('管理用コマンド')
    // アナウンスコマンド
    .addSubcommand(sub =>
      sub.setName('announce')
        .setDescription('アナウンスを送信（文章はポップアップで入力）')
        // .setRequired(false) にして任意入力にしました！
        .addRoleOption(o => o.setName('role').setDescription('付与・解除させたいロール（空欄ならボタンなし）').setRequired(false))
        .addBooleanOption(o => o.setName('sticky').setDescription('最下行に常駐（固定）させるか（デフォルト: いいえ）').setRequired(false))
    )
    // アラームコマンド
    .addSubcommand(sub =>
      sub.setName('alarm')
        .setDescription('日本時刻でアラームを設定（複数指定はスペース区切り）')
        .addStringOption(o => o.setName('times').setDescription('時刻（例: 15:30 21:00 23:00）').setRequired(true))
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

    // --- 1. アナウンス（モーダル ＆ 任意ボタン式） ---
    if (subcommand === 'announce') {
      const role = interaction.options.getRole('role');
      const isSticky = interaction.options.getBoolean('sticky') || false;
      
      // ロールが選ばれていない場合は "none" をIDの代わりにしてモーダルに引き渡す
      const roleIdParam = role ? role.id : 'none';

      // 文章を入力するポップアップ（モーダル）を作成
      const modal = new ModalBuilder()
        .setCustomId(`announce_modal_${roleIdParam}_${isSticky}`)
        .setTitle('アナウンス内容の入力');

      const textInput = new TextInputBuilder()
        .setCustomId('announce_text')
        .setLabel('案内文章（ここで普通に改行できます）')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(textInput));

      return await interaction.showModal(modal);
    }

    // --- 2. アラーム ---
    if (subcommand === 'alarm') {
      const timesInput = interaction.options.getString('times');
      const message = interaction.options.getString('message');
      
      const timeInputs = timesInput.split(/[\s ]+/).filter(Boolean);
      const registeredTimes = [];

      if (!config.alarms) config.alarms = [];

      for (const timeStr of timeInputs) {
        const targetTime = parseTimeToMs(timeStr);
        if (!targetTime) continue;

        const alarmData = { time: targetTime, channelId: interaction.channelId, message };
        config.alarms.push(alarmData);
        registeredTimes.push(timeStr);

        const delay = targetTime - Date.now();

        setTimeout(async () => {
          const channel = await client.channels.fetch(interaction.channelId).catch(() => null);
          if (channel) await channel.send(message);

          const currentConfig = loadConfig();
          currentConfig.alarms = (currentConfig.alarms || []).filter(a => a.time !== targetTime);
          saveConfig(currentConfig);
        }, delay);
      }

      if (registeredTimes.length === 0) {
        return interaction.reply({ content: '❌ 時刻の形式が正しくありません。「15:30」や「21:00 23:45」のように入力してください。', ephemeral: true });
      }

      return interaction.reply({ 
        content: `⏰ 以下の時刻にアラームを設定しました。\n設定時刻: ${registeredTimes.map(t => `**${t}**`).join(', ')}`, 
        ephemeral: true 
      });
    }

    // --- 3. VC通知先設定 ---
    if (subcommand === 'setvc') {
      config.vcNotifyChannelId = interaction.channelId;
      saveConfig(config);
      return interaction.reply({ content: `✅ VC参加の通知先をこのチャンネル（ <#${interaction.channelId}> ）に設定しました。`, ephemeral: true });
    }
  },
};
