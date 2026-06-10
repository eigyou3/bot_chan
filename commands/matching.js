const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('ロール付与付きの参戦募集を開始します')
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
    const text = interaction.options.getString('text');
    const role = interaction.options.getRole('role');

    const data = {
      text: text,
      roleId: role.id,
      participants: [] // { id, displayName } のオブジェクトを入れていく配列
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('match_join').setLabel('参加する！').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('match_leave').setLabel('辞退する').setStyle(ButtonStyle.Secondary)
    );

    // 💡 1. 見た目を綺麗な枠付きEmbedに変更
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(`┃ ${text}`); // 💡 2. 対象ロールのテキストを消去

    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    if (!client.matchStorage) client.matchStorage = new Map();
    if (!client.matchChannelMap) client.matchChannelMap = new Map();

    client.matchStorage.set(interaction.channelId, data);
    client.matchChannelMap.set(interaction.channelId, response.id);
  },
};
