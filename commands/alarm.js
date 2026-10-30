const { done } = require('../utils/feedback');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const st = require('../utils/store');
const { isAdmin, deny } = require('../utils/perm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alarm')
    .setDescription('毎日繰り返すアラームを設定（複数指定はスペース区切り）')
    .addStringOption(o => o.setName('times').setDescription('時刻（例: 15:30 21:00）').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('通知メッセージ').setMaxLength(2000).setRequired(true)),

  async execute(interaction) {
    if (!isAdmin(interaction)) return deny(interaction);

    const g = interaction.guild;
    const d = st.get(g.id);
    const msg = interaction.options.getString('message');
    const ins = interaction.options.getString('times').split(/[\s　]+/).filter(Boolean);
    const ok = [];
    const setter = { by: interaction.user.id, byName: interaction.member?.displayName || interaction.user.globalName || interaction.user.username, byAvatar: interaction.user.displayAvatarURL() };

    for (const s of ins) {
      const m = s.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (!m) continue;
      // 5:30 -> 05:30
      const t = `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
      const existing = d.alarms.find(a => a.time === t && a.ch === interaction.channelId && a.msg === msg);
      if (existing) Object.assign(existing, setter);
      else d.alarms.push({ time: t, ch: interaction.channelId, msg, ...setter });
      ok.push(t);
    }

    if (!ok.length) {
      return interaction.reply({ content: '❌ 時刻の形式が正しくありません。「15:30」や「21:00」のように入力してください。', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    if (!await st.save(g)) return interaction.editReply('⚠️ アラームの設定を保存できませんでした。#bot-config の権限を確認して、再設定してください。');
    return done(interaction, { embeds: [new EmbedBuilder().setColor('#BA7517').setAuthor({ name: `${setter.byName} さんのアラーム`, iconURL: setter.byAvatar }).setDescription(`⏰ 毎日のアラームを設定しました。\n設定者：<@${setter.by}>\n設定時刻：${[...new Set(ok)].join('、')}${st.warn(g)}`)] });
  },
};
