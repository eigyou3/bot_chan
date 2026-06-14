const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('entry')
    .setDescription('大会の参戦募集を開始します')
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
    // 💡 誰が使ったか非表示にするため、最初から ephemeral: true でコマンド自体への応答を完了させる
    await interaction.reply({ content: '✅ エントリー募集を開始しました。', ephemeral: true });

    const text = interaction.options.getString('text');
    const role = interaction.options.getRole('role');
    const channel = interaction.channel;

    try {
      await interaction.guild.members.fetch({ withPresences: false });
    } catch (error) {
      console.error(error);
    }

    const initialParticipants = [];
    const targetRole = await interaction.guild.roles.fetch(role.id);
    
    if (targetRole) {
      targetRole.members.forEach(member => {
        if (!member.user.bot) {
          initialParticipants.push({
            id: member.id,
            name: member.displayName
          });
        }
      });
    }

    const data = {
      text: text,
      roleId: role.id,
      participants: initialParticipants
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('entry_join')
        .setLabel('参加する！')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('entry_leave')
        .setLabel('辞退する')
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(text); // 💡 入力された任意のテキストがそのまま反映されます

    if (data.participants.length > 0) {
      const names = data.participants.map(p => p.name).join(', ');
      embed.addFields({ name: '現在の参加者', value: names });
    }

    // 💡 interaction.editReply ではなく、チャンネルに直接新規メッセージとして送信
    const response = await channel.send({
      embeds: [embed],
      components: [row]
    });

    if (!client.entryStorage) client.entryStorage = new Map();
    if (!client.entryChannelMap) client.entryChannelMap = new Map();

    // 💡 チャンネルIDをキーにして、生成したメッセージのデータを登録（常駐処理用）
    client.entryStorage.set(channel.id, data);
    client.entryChannelMap.set(channel.id, response.id);
  },
};
