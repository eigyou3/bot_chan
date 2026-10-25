const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const chr = require('../utils/character');

// 原神サーバー専用
const GUILD = '1386706264578461726';

module.exports = {
  guild: GUILD,
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('キャラのビルドカードを出す'),

  async execute(interaction) {
    if (interaction.guildId !== GUILD) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5F5E5A').setDescription('❌ このサーバーではこのコマンドを使用できません。')], ephemeral: true });
    }
    return chr.start(interaction);
  },
};
