const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const chr = require('../utils/buildPanel');

const { isGI } = require('../utils/gi');

module.exports = {
  genshin: true,
  data: new SlashCommandBuilder()
    .setName('build-card')
    .setDescription('ビルドカード作成の案内をこのチャンネルに設置する'),

  async execute(interaction) {
    if (!isGI(interaction.guildId)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5F5E5A').setDescription('❌ このサーバーではこのコマンドを使用できません。')], ephemeral: true });
    }
    return chr.start(interaction);
  },
};
