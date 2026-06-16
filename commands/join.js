const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('ボイスチャンネルに参加して読み上げを開始します'),

  async execute(interaction, client) {
    const member = interaction.member;
    const guildId = interaction.guild.id;

    if (!member.voice.channel) {
      return interaction.reply({ content: '❌ 先にボイスチャンネルに入室してください。', ephemeral: true });
    }

    const existingConnection = getVoiceConnection(guildId);
    if (existingConnection) {
      return interaction.reply({ content: '❌️すでに参加しています。', ephemeral: true });
    }

    const voiceChannel = member.voice.channel;
    const humanMembers = voiceChannel.members.filter(m => !m.user.bot);
    if (humanMembers.size === 0) {
      return interaction.reply({ content: '❌️誰もいないVCには参加できません', ephemeral: true });
    }

    // 1. ボイスチャンネルに接続
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    // 💡 【超重要】接続直後に空のプレイヤーをバインドして、Discord側のヘッドホン斜線を強制解除する
    const dummyPlayer = createAudioPlayer();
    connection.subscribe(dummyPlayer);

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
