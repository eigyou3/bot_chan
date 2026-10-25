const { SlashCommandBuilder } = require('discord.js');
const { isAdmin, deny } = require('../utils/perm');
const { place } = require('../utils/intro');

// このサーバー専用
const GUILD = '1386706264578461726';

module.exports = {
  guild: GUILD,
  data: new SlashCommandBuilder()
    .setName('intro')
    .setDescription('UID登録（自己紹介）の案内をこのチャンネルに置きます')
    .addRoleOption(o => o.setName('role').setDescription('登録した人に付けるロール').setRequired(true)),

  async execute(interaction) {
    if (interaction.guildId !== GUILD) {
      return interaction.reply({ content: '❌ このサーバーではこのコマンドを使用できません。', ephemeral: true });
    }
    if (!isAdmin(interaction)) return deny(interaction);

    const role = interaction.options.getRole('role');
    await interaction.deferReply({ ephemeral: true });
    await place(interaction.channel, role.id);
    return interaction.editReply(`✅ 案内を置きました（常に一番下に表示）。登録した人には <@&${role.id}> が付きます。`);
  },
};
