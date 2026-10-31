const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isGI } = require('../utils/gi');
const { isAdmin, deny } = require('../utils/perm');
const { generalGuide, genshinGuide } = require('../utils/help');
module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('初期設定とコマンドの使い方を表示します'),
  execute: i => isAdmin(i) ? i.reply({ embeds: [generalGuide(), ...(isGI(i.guildId) ? [genshinGuide()] : [])], allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral }) : deny(i),
};
