const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildAnnounceEmbed } = require('../utils/teamMaker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('チームマッチングを開始します')
    .addStringOption(option =>
      option.setName('sort')
        .setDescription('集計方法を選択')
        .setRequired(true)
        .addChoices(
          { name: 'バランス', value: 'balance' },
          { name: 'スネーク', value: 'snake' }
        )
    ),
  async execute(interaction, client) {
    const sortMethod = interaction.options.getString('sort');
    const sortLabel = sortMethod === 'snake' ? 'スネーク方式' : '平均化方式';

    const data = {
      sortMethod,
      sortLabel,
      participants: [],
      authorId: interaction.user.id,
      authorTag: interaction.user.tag,
      authorAvatar: interaction.user.displayAvatarURL({ dynamic: true })
    };

    // 1段目：参加者向けボタン（絵文字削除）
    const userRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('join_match').setLabel('参加する').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('leave_match').setLabel('削除する').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('edit_power').setLabel('戦力変更').setStyle(ButtonStyle.Primary)
    );

    // 2段目：管理者向けボタン（絵文字削除）
    const adminRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('change_method').setLabel('集計方法変更').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('calc_match').setLabel('集計').setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.reply({
      embeds: [buildAnnounceEmbed(data)],
      components: [userRow, adminRow],
      fetchReply: true
    });

    if (!client.matchingData) client.matchingData = new Map();
    if (!client.channelMap) client.channelMap = new Map();

    client.matchingData.set(response.id, data);
    client.channelMap.set(interaction.channelId, response.id);
  },
};
