const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// 来場予約の通知先ロールID（画像生成機能で使用）
const NOTIFY_ROLE_ID = '1496147336043298866';

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // Bot自身の発言はすべて無視
    if (message.author.bot) return;

    // --- 1. 来場予約（画像生成）の処理 ---
    // 「数字/数字」または「数字月数字」と「様」または「さん」が含まれているか判定
    const hasDateAndName =
      /[\d０-９]{1,2}[\/／月][\d０-９]{1,2}/.test(message.content) &&
      /様|さん/.test(message.content);

    if (hasDateAndName) {
      const { parseVisitorMessage, generateWelcomeImage } = require('../utils/imageGenerator');
      const parsed = parseVisitorMessage(message.content);

      if (parsed) {
        try {
          // 画像を生成（幅1920、高さ1080）
          const buffer = await generateWelcomeImage(parsed, 1920, 1080);
          const file = new AttachmentBuilder(buffer, { name: 'welcome.jpg' });

          const member = message.member;
          const roleColor = member?.roles?.color?.hexColor ?? '#808080';

          const embed = new EmbedBuilder()
            .setColor(roleColor)
            .setDescription(
              `<@${message.author.id}> ！\n` +
              `${parsed.date.replace('/', '月')}日 ${parsed.time.replace(':', '時')}分 ${parsed.name}のウェルカムを作成したよ！\n\n` +
              `<@&${NOTIFY_ROLE_ID}> みんなにも共有しておくね！`
            )
            .setImage('attachment://welcome.jpg');

          await message.reply({ embeds: [embed], files: [file] });
        } catch (error) {
          console.error('画像生成または送信中にエラーが発生しました:', error);
        }
        // 画像生成に反応した場合は、マッチングの再投稿処理を行わずにここで終了
        return;
      }
    }

    // --- 2. チームマッチングのアナウンス常駐（最下部への再投稿）処理 ---
    if (!client.channelMap) client.channelMap = new Map();
    const activeMessageId = client.channelMap.get(message.channelId);

    if (activeMessageId) {
      try {
        // 現在の募集メッセージを取得
        const oldMessage = await message.channel.messages.fetch(activeMessageId).catch(() => null);
        
        if (oldMessage) {
          // 過去のメッセージを削除
          await oldMessage.delete().catch(() => null);

          // 新しく同じ内容で一番下に再投稿
          const newMessage = await message.channel.send({
            embeds: oldMessage.embeds,
            components: oldMessage.components
          });

          // チャンネルに紐づく最新のメッセージIDを更新
          client.channelMap.set(message.channelId, newMessage.id);
        }
      } catch (error) {
        console.error('マッチングメッセージの再投稿に失敗しました:', error);
      }
    }
  },
};