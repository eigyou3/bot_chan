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
    const hasDateAndName =
      /[\d０-９]{1,2}[\/／月][\d０-９]{1,2}/.test(message.content) &&
      /様|さん/.test(message.content);

    if (hasDateAndName) {
      const { parseVisitorMessage, generateWelcomeImage } = require('../utils/imageGenerator');
      const parsed = parseVisitorMessage(message.content);

      if (parsed) {
        try {
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
        return;
      }
    }

    // --- 2. アナウンスの常駐（最下部への再投稿）処理 ---
    if (!client.stickyMap) client.stickyMap = new Map();
    const stickyData = client.stickyMap.get(message.channelId);

    if (stickyData) {
      try {
        const oldMessage = await message.channel.messages.fetch(stickyData.messageId).catch(() => null);
        
        if (oldMessage) {
          await oldMessage.delete().catch(() => null);

          const newMessage = await message.channel.send({
            embeds: oldMessage.embeds,
            components: oldMessage.components
          });

          client.stickyMap.set(message.channelId, {
            messageId: newMessage.id,
            text: stickyData.text
          });
        }
      } catch (error) {
        console.error('常駐メッセージの再投稿に失敗しました:', error);
      }
    }

    // --- 3. チームマッチングのアナウンス常駐（最下部への再投稿＆データ引っ越し）処理 ---
    if (!client.channelMap) client.channelMap = new Map();
    const activeMessageId = client.channelMap.get(message.channelId);

    if (activeMessageId) {
      try {
        const oldMessage = await message.channel.messages.fetch(activeMessageId).catch(() => null);
        
        if (oldMessage) {
          // メモリから古いメッセージIDに紐づいているマッチングデータを取得して退避
          if (!client.matchingData) client.matchingData = new Map();
          const currentData = client.matchingData.get(activeMessageId);

          // 古いメッセージを削除して一番下に新しく送り直す
          await oldMessage.delete().catch(() => null);
          const newMessage = await message.channel.send({
            embeds: oldMessage.embeds,
            components: oldMessage.components
          });

          // チャンネルに紐づく最新のメッセージIDを更新
          client.channelMap.set(message.channelId, newMessage.id);

          // データが存在していた場合、新しいメッセージIDを鍵にしてメモリに保存し直す（古いIDのデータは削除）
          if (currentData) {
            client.matchingData.set(newMessage.id, currentData);
            client.matchingData.delete(activeMessageId);
          }
        }
      } catch (error) {
        console.error('マッチングメッセージの再投稿に失敗しました:', error);
      }
    }
  },
};
