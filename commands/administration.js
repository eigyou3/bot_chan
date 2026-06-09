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

// 時刻文字列（"HH:MM"）を本日のミリ秒に変換するヘルパー
function parseTimeToMs(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^([0-2]?\d):([0-5]\d)$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  const now = new Date();
  // RenderのタイムゾーンがUTCの場合を考慮し、日本時間(JST)で計算
  const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  
  const target = new Date(jstNow);
  target.setHours(hours, minutes, 0, 0);

  // もし指定された時刻がすでに過ぎている場合は翌日のその時刻にする
  if (target.getTime() <= jstNow.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  // 現実の時間（UTC/ローカル）の差分に直して、実行までのミリ秒を割り出す
  const diffMs = target.getTime() - jstNow.getTime();
  return Date.now() + diffMs;
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
        .setDescription('日本時刻でアラームを設定（最大3つ）')
        .addStringOption(o => o.setName('time1').setDescription('時刻1（例 15:30）').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('通知メッセージ').setRequired(true))
        .addStringOption(o => o.setName('time2').setDescription('時刻2（任意 例 21:00）').setRequired(false))
        .addStringOption(o => o.setName('time3').setDescription('時刻3（任意 例 23:45）').setRequired(false))
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

    // --- 1. 通常アナウンス ---
    if (subcommand === 'announce') {
      const text = interaction.options.getString('text').replace(/\\n/g, '\n');
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');

      const embed = new EmbedBuilder().setColor('#5865F2').setDescription(text);
      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      await msg.react(emoji);

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

    // --- 3. アラーム設定（日本時刻版） ---
    if (subcommand === 'alarm') {
      const timeInputs = [
        interaction.options.getString('time1'),
        interaction.options.getString('time2'),
        interaction.options.getString('time3')
      ].filter(Boolean);

      const message = interaction.options.getString('message');
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
        return interaction.reply({ content: '❌ 時刻の形式が正しくありません。「15:30」や「9:05」のように入力してください。', ephemeral: true });
      }

      return interaction.reply({ 
        content: `⏰ 以下の時刻にアラームを設定しました（このチャンネルに通知します）。\n設定時刻: ${registeredTimes.map(t => `**${t}**`).join(', ')}`, 
        ephemeral: true 
      });
    }

    // --- 4. VC通知先設定（コマンド実行チャンネル自動固定版） ---
    if (subcommand === 'setvc') {
      config.vcNotifyChannelId = interaction.channelId;
      saveConfig(config);

      return interaction.reply({ content: `✅ VC参加の通知先をこのチャンネル（ <#${interaction.channelId}> ）に設定しました。`, ephemeral: true });
    }
  },
};
