const { SlashCommandBuilder } = require('discord.js');
const { isAdmin, deny } = require('../utils/perm');
const { place } = require('../utils/intro');

const { isGI } = require('../utils/gi');

module.exports = {
  genshin: true,
  data: new SlashCommandBuilder()
    .setName('intro')
    .setDescription('UID登録（自己紹介）の案内をこのチャンネルに置きます')
    .addRoleOption(o => o.setName('role').setDescription('登録した人に付けるロール').setRequired(true)),

  async execute(interaction) {
    if (!isGI(interaction.guildId)) {
      return interaction.reply({ content: '❌ このサーバーではこのコマンドを使用できません。', ephemeral: true });
    }
    if (!isAdmin(interaction)) return deny(interaction);

    const role = interaction.options.getRole('role');
    await interaction.deferReply({ ephemeral: true });
    await place(interaction.channel, role.id);
    return interaction.deleteReply();
  },
};
