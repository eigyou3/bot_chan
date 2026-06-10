const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('ロール付与付きの参戦募集を開始します（古いロールは自動リセットされます）')
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
    // 処理に時間がかかる場合（人数が多い時など）にDiscord側がタイムアウトするのを防ぐ
    await interaction.deferReply();

    const text = interaction.options.getString('text');
    const role = interaction.options.getRole('role');


    try {
      // サーバー内の最新のメンバー情報をキャッシュ（または取得）する
      await interaction.guild.members.fetch();
      
      // 指定されたロールを持っているメンバーを全員抽出
      const membersWithRole = role.members;

      if (membersWithRole.size > 0) {
        // 全員からロールを一斉に削除
        for (const [memberId, member] of membersWithRole) {
          await member.roles.remove(role).catch(() => null);
        }
      }
    } catch (error) {
      console.error('古いロールのリセット処理に失敗しました:', error);
    }
    // ==========================================

    const data = {
      text: text,
      roleId: role.id,
      participants: [] // 毎週ここもまっさらな状態でスタート
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('match_join').setLabel('参加する！').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('match_leave').setLabel('辞退する').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(text);

    // deferReply を使っているので、reply ではなく editReply でメッセージを出します
    const response = await interaction.editReply({
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
