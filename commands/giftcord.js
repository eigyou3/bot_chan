const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin, deny } = require('../utils/perm');
const { place } = require('../utils/gift');

// 原神サーバー専用
const GUILD = '1386706264578461726';

module.exports = {
  guild: GUILD,
  data: new SlashCommandBuilder()
    .setName('giftcord')
    .setDescription('ギフトコード共有の案内をこのチャンネルに置きます'),

  async execute(interaction) {
    const box = t => ({ embeds: [new EmbedBuilder().setColor('#BA7517').setDescription(t)], ephemeral: true });
    if (interaction.guildId !== GUILD) return interaction.reply(box('❌ このサーバーではこのコマンドを使用できません。'));
    if (!isAdmin(interaction)) return deny(interaction);

    await interaction.deferReply({ ephemeral: true });
    await place(interaction.channel);
    return interaction.editReply(box('✅ 案内を置きました（常に一番下に表示）。'));
  },
};
