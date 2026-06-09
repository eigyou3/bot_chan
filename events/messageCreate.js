const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

const NOTIFY_ROLE_ID = '1496147336043298866';

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    // --- 1. 来場予約の処理 ---
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
          console.error(error);
        }
        return;
      }
    }

    // --- 2. アナウンスの常駐処理 ---
    if (!client.stickyMap) client.stickyMap = new Map();
    const stickyData = client.stickyMap.get(message.channelId);

    if (stickyData) {
      try {
        const oldMessage = await message.channel.messages.fetch(stickyData.messageId).catch(() => null);
        if (oldMessage) {
          await oldMessage.delete().catch(() => null);
          const newMessage = await message.channel.send({ embeds: oldMessage.embeds, components: oldMessage.components });
          client.stickyMap.set(message.channelId, { messageId: newMessage.id, text: stickyData.text });
        }
      } catch (error) {
        console.error(error);
      }
    }

    // --- 3. チームマッチングのアナウンス常駐処理 ---
    if (!client.channelMap) client.channelMap = new Map();
    const activeMessageId = client.channelMap.get(message.channelId);

    if (activeMessageId) {
      try {
        const oldMessage = await message.channel.messages.fetch(activeMessageId).catch(() => null);
        if (oldMessage) {
          await oldMessage.delete().catch(() => null);
          const newMessage = await message.channel.send({ embeds: oldMessage.embeds, components: oldMessage.components });
          
          // 💡 データの移行はせず、最新のメッセージIDを記録するだけにリセット
          client.channelMap.set(message.channelId, newMessage.id);
        }
      } catch (error) {
        console.error(error);
      }
    }
  },
};
