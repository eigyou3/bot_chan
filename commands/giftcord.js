const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin, deny } = require('../utils/perm');
const { place } = require('../utils/gift');

const { GI } = require('../utils/gi');

module.exports = {
  guild: GI,
  data: new SlashCommandBuilder()
    .setName('giftcord')
    .setDescription('ギフトコード共有の案内をこのチャンネルに置きます'),

  async execute(interaction) {
    const box = t => ({ embeds: [new EmbedBuilder().setColor('#BA7517').setDescription(t)], ephemeral: true });
    if (!GI.includes(interaction.guildId)) return interaction.reply(box('❌ このサーバーではこのコマンドを使用できません。'));
    if (!isAdmin(interaction)) return deny(interaction);

    await interaction.deferReply({ ephemeral: true });
    await place(interaction.channel);
    return interaction.deleteReply();
  },
};
