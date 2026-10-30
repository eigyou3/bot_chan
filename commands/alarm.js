const { done } = require('../utils/feedback');
const { SlashCommandBuilder } = require('discord.js');
const st = require('../utils/store');
const { isAdmin, deny } = require('../utils/perm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alarm')
    .setDescription('毎日繰り返すアラームを設定（複数指定はスペース区切り）')
    .addStringOption(o => o.setName('times').setDescription('時刻（例: 15:30 21:00）').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('通知メッセージ').setRequired(true)),

  async execute(interaction) {
    if (!isAdmin(interaction)) return deny(interaction);

    const g = interaction.guild;
    const d = st.get(g.id);
    const msg = interaction.options.getString('message');
    const ins = interaction.options.getString('times').split(/[\s　]+/).filter(Boolean);
    const ok = [];

    for (const s of ins) {
      const m = s.trim().match(/^([0-2]?\d):([0-5]\d)$/);
      if (!m) continue;
      // 5:3 -> 05:03
      const t = `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
      if (!d.alarms.some(a => a.time === t && a.ch === interaction.channelId && a.msg === msg)) {
        d.alarms.push({ time: t, ch: interaction.channelId, msg });
      }
      ok.push(t);
    }

    if (!ok.length) {
      return interaction.reply({ content: '❌ 時刻の形式が正しくありません。「15:30」や「21:00」のように入力してください。', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    await st.save(g);
    return done(interaction, `⏰ 以下の時刻に毎日繰り返すアラームを設定しました。\n設定時刻: ${ok.map(t => `**${t}**`).join(', ')}${st.warn(g)}`);
  },
};
