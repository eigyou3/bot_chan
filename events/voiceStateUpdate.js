const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// 設定データの読み込み先
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    // VCに参加した瞬間（入室）のみを検知
    if (!newState.channelId) return;
    if (oldState.channelId === newState.channelId) return;

    const vcChannel = newState.channel;
    // 参加したチャンネルが存在し、かつ中にいるのが「最初の1人」である場合のみ処理
    if (!vcChannel || vcChannel.members.size !== 1) return;

    // 通知先チャンネルの設定を取得
    const config = loadConfig();
    if (!config.vcNotifyChannelId) return;

    const notifyChannel = newState.guild.channels.cache.get(config.vcNotifyChannelId);
    if (!notifyChannel) return;

    const member = newState.member;
    // 参加者のロールの色、またはDiscordの標準ブルーをテーマカラーにする
    const roleColor = member?.roles?.color?.hexColor ?? '#5865F2';

    // 通知用のEmbed（カード型メッセージ）を作成
    const embed = new EmbedBuilder()
      .setColor(roleColor)
      .setAuthor({
        name: member.displayName,
        iconURL: member.user.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(`<@${member.id}> が通話を始めました！\n気軽に参加してね！`)
      .setTimestamp();

    // 押すとそのVCに一発でジャンプできるリンクボタンを作成
    const vcRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('通話に参加する')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${newState.guild.id}/${newState.channelId}`)
    );

    // 通知を送信
    await notifyChannel.send({ embeds: [embed], components: [vcRow] });
  },
};