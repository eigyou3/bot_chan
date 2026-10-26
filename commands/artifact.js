const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const art = require('../utils/artifact');

const { GI } = require('../utils/gi');

module.exports = {
  guild: GI,
  data: new SlashCommandBuilder()
    .setName('artifact')
    .setDescription('自慢の聖遺物を見せびらかす'),

  async execute(interaction) {
    if (!GI.includes(interaction.guildId)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5F5E5A').setDescription('❌ このサーバーではこのコマンドを使用できません。')], ephemeral: true });
    }
    return art.start(interaction);
  },
};
