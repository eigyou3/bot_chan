const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('ボイスチャンネルに参加して読み上げを開始します'),

  async execute(interaction, client) {
    const member = interaction.member;
    const guildId = interaction.guild.id;

    // 1. コマンドを打った人がVCにいるかチェック
    if (!member.voice.channel) {
      return interaction.reply({ content: '❌ 先にボイスチャンネルに入室してください。', ephemeral: true });
    }

    // 2. すでにBotがVCに参加しているかチェック
    const existingConnection = getVoiceConnection(guildId);
    if (existingConnection) {
      return interaction.reply({ content: '❌️すでに参加しています。', ephemeral: true });
    }

    // 3. 誰もいないVC（自分以外に人間がいない）に接続しようとしたかチェック
    const voiceChannel = member.voice.channel;
    const humanMembers = voiceChannel.members.filter(m => !m.user.bot);
    if (humanMembers.size === 0) {
      return interaction.reply({ content: '❌️誰もいないVCには参加できません', ephemeral: true });
    }

    // 接続処理
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    // 読み上げ対象のテキストチャンネルIDを記憶
    if (!client.ttsChannels) client.ttsChannels = new Map();
    client.ttsChannels.set(guildId, interaction.channelId);

    // Embedで参加メッセージを送信
    const roleColor = member?.roles?.color?.hexColor ?? '#5865F2';
    const embed = new EmbedBuilder()
      .setColor(roleColor)
      .setDescription('🚪VCに参加しました。');

    await interaction.reply({ embeds: [embed] });
  },
};
