const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('entry') 
    .setDescription('大会の参戦募集を開始します（古いロールは自動リセットされます）')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('募集本文を入力してください')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('参加者に付与するロールを選択してください')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    await interaction.deferReply();

    const text = interaction.options.getString('text');
    const role = interaction.options.getRole('role');

    // 古いロールの一括リセット処理
    try {
      await interaction.guild.members.fetch();
      const membersWithRole = role.members;

      if (membersWithRole.size > 0) {
        for (const [memberId, member] of membersWithRole) {
          await member.roles.remove(role).catch(() => null);
        }
      }
    } catch (error) {
      console.error('古いロールのリセット処理に失敗しました:', error);
    }

    const data = {
      text: text,
      roleId: role.id,
      participants: [] // { id, name }
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('entry_join').setLabel('参加する！').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('entry_leave').setLabel('辞退する').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(text);

    const response = await interaction.editReply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    if (!client.entryStorage) client.entryStorage = new Map();
    if (!client.entryChannelMap) client.entryChannelMap = new Map();

    client.entryStorage.set(interaction.channelId, data);
    client.entryChannelMap.set(interaction.channelId, response.id);
  },
};
