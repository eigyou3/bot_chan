const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const art = require('../utils/artifact');

// 原神サーバー専用
const GUILD = '1386706264578461726';

module.exports = {
  guild: GUILD,
  data: new SlashCommandBuilder()
    .setName('artifact')
    .setDescription('自慢の聖遺物を見せびらかす'),

  async execute(interaction) {
    if (interaction.guildId !== GUILD) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5F5E5A').setDescription('❌ このサーバーではこのコマンドを使用できません。')], ephemeral: true });
    }
    return art.start(interaction);
  },
};
