const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { isAdmin, deny } = require('../utils/perm');
const { ensureConfig } = require('../utils/setup');
const { generalGuide } = require('../utils/help');

module.exports = {
  data: new SlashCommandBuilder().setName('setup').setDescription('設定保存用のbot-configを準備して使い方を表示します').setContexts(InteractionContextType.Guild),
  async execute(i) {
    if (!isAdmin(i)) return deny(i);
    await i.deferReply();
    try {
      const ch = await ensureConfig(i.guild);
      return i.editReply({ content: `設定の保存先：<#${ch.id}>\nこのチャンネルは削除・改名しないでください。`, embeds: [generalGuide()], allowedMentions: { parse: [] } });
    } catch (e) { return i.editReply(`⚠️ ${e.message}`); }
  },
};
