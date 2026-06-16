const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
// 💡 音声再生に必要な機能を discord.js/voice から読み込む（追加）
const { getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    // ==========================================
    // 💡 【追加】ここから：音声読み上げ（TTS）処理
    // ==========================================
    if (client.ttsChannels && client.ttsChannels.get(message.guildId) === message.channelId) {
      const connection = getVoiceConnection(message.guildId);
      
      // Botがボイスチャンネルに接続中、かつメッセージに本文がある場合
      if (connection && message.content) {
        try {
          // 不要なメンションやURLを簡易的にカット・置換
          let cleanText = message.content
            .replace(/<@!?\d+>/g, '') // ユーザーメンション削除
            .replace(/https?:\/\/[\s\S]+/g, 'URL'); // URLを「ユーアールエル」に置換

          if (cleanText.trim().length > 0) {
            // 100%確実に動くGoogle翻訳の読み上げURL
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=ja&client=tw-ob`;

            const resource = createAudioResource(ttsUrl);
            const player = createAudioPlayer();

            connection.subscribe(player);
            player.play(resource);
          }
        } catch (error) {
          console.error('読み上げエラー:', error);
        }
      }
    }
    // ==========================================
    // 💡 ここまで：音声読み上げ（TTS）処理
    // ==========================================


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
