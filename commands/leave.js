const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('ボイスチャンネルから退出して読み上げを終了します'),

  async execute(interaction, client) {
    const guildId = interaction.guild.id;
    const connection = getVoiceConnection(guildId);

    // BotがVCにいない場合
    if (!connection) {
      return interaction.reply({ content: '❌ Botはボイスチャンネルに参加していません。', ephemeral: true });
    }

    // 切断処理
    connection.destroy();

    if (client.ttsChannels) {
      client.ttsChannels.delete(guildId);
    }

    // Embedで退場メッセージを送信
    const roleColor = interaction.member?.roles?.color?.hexColor ?? '#5865F2';
    const embed = new EmbedBuilder()
      .setColor(roleColor)
      .setDescription('🏃VCを退場しました。');

    await interaction.reply({ embeds: [embed] });
  },
};
