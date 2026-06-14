const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    // 1. アナウンスの常駐処理
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

    // 2. エントリー募集のアナウンス常駐処理
    if (!client.entryChannelMap) client.entryChannelMap = new Map();
    const activeMessageId = client.entryChannelMap.get(message.channelId);

    if (activeMessageId) {
      try {
        const oldMessage = await message.channel.messages.fetch(activeMessageId).catch(() => null);
        if (oldMessage) {
          await oldMessage.delete().catch(() => null);
          
          const newMessage = await message.channel.send({
            embeds: oldMessage.embeds,
            components: oldMessage.components
          });
          
          client.entryChannelMap.set(message.channelId, newMessage.id);
        }
      } catch (error) {
        console.error(error);
      }
    }
  },
};
