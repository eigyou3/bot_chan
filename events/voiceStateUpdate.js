const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice'); // 💡 TTSの接続確認用に追記

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {

    // ==========================================
    // 💡 【追加】ここから：最後の一人がいなくなったら自動退場
    // ==========================================
    const guildId = oldState.guild.id;
    const connection = getVoiceConnection(guildId);

    // Botがボイスチャンネルに接続している場合のみチェック
    if (connection) {
      const botChannelId = oldState.guild.members.me?.voice.channelId;
      
      // 誰かがBotと同じチャンネルから切断・移動したとき
      if (botChannelId && oldState.channelId === botChannelId && newState.channelId !== botChannelId) {
        const channel = oldState.channel;
        
        // チャンネルに残っている人間の数をカウント（Botは除外）
        const humanMembers = channel.members.filter(member => !member.user.bot);

        // 最後の一人がいなくなったら
        if (humanMembers.size === 0) {
          // メッセージは送信せず、接続の切断と記憶のリセットだけをひっそり行う
          connection.destroy();

          if (client.ttsChannels) {
            client.ttsChannels.delete(guildId);
          }

          console.log(`[TTS] 最後の1人が退室したため、発言なしで自動退出しました。`);
        }
      }
    }
    // ==========================================
    // 💡 ここまで：最後の一人がいなくなったら自動退場
    // ==========================================


    // ==========================================
    // 🔊 ここから：元の通話開始通知処理（そのまま維持）
    // ==========================================
    if (!newState.channelId) return;
    if (oldState.channelId === newState.channelId) return;

    const vcChannel = newState.channel;
    if (!vcChannel || vcChannel.members.size !== 1) return;

    if (!client.vcNotifyMap) client.vcNotifyMap = new Map();
    
    const notifyChannelId = client.vcNotifyMap.get(newState.guild.id);
    if (!notifyChannelId) return;

    const notifyChannel = newState.guild.channels.cache.get(notifyChannelId);
    if (!notifyChannel) return;

    const member = newState.member;
    const roleColor = member?.roles?.color?.hexColor ?? '#5865F2';

    const embed = new EmbedBuilder()
      .setColor(roleColor)
      .setAuthor({
        name: member.displayName,
        iconURL: member.user.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(`<@${member.id}> が **🔊 ${vcChannel.name}** で通話を始めました！\n気軽に参加してね！`)
      .setTimestamp();

    const vcRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('通話に参加する')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${newState.guild.id}/${newState.channelId}`)
    );

    await notifyChannel.send({ embeds: [embed], components: [vcRow] });
    // ==========================================
    // 🔊 ここまで：元の通話開始通知処理
    // ==========================================
  },
};
