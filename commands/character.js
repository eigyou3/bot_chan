const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const chr = require('../utils/character');

const { GI } = require('../utils/gi');

module.exports = {
  guild: GI,
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('キャラのビルドカードを出す'),

  async execute(interaction) {
    if (!GI.includes(interaction.guildId)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5F5E5A').setDescription('❌ このサーバーではこのコマンドを使用できません。')], ephemeral: true });
    }
    return chr.start(interaction);
  },
};
