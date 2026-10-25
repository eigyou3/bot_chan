const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const st = require('../utils/store');
const wel = require('../utils/welcome');
const vr = require('../utils/vcrank');
const { parseVisitorMessage } = require('../utils/imageGenerator');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // VCランキングを一番下に（自分の投稿は無視）
    if (message.guild && message.author.id !== client.user.id && message.channelId === st.get(message.guildId).vc) {
      vr.bump(message.guild).catch(() => null);
    }

    if (message.author.bot) return;

    // --- 1. 来場予約の処理 ---
    // 時間と様/さんが入ってたら反応（全角もOK）
    if (message.guild && /[\d０-９]{1,2}\s*[：:時]\s*[\d０-９]{2}/.test(message.content) && /様|さん/.test(message.content)) {
      const parsed = parseVisitorMessage(message.content);
      if (parsed) {
        try {
          await wel.handle(message, parsed);
        } catch (e) {
          console.error(e);
        }
        return;
      }
    }

    // --- 2. アナウンスの常駐処理 ---
    if (!message.guild) return;
    const sk = st.get(message.guildId).sticky[message.channelId];
    if (!sk) return;

    try {
      const old = await message.channel.messages.fetch(sk.messageId).catch(() => null);
      if (old) await old.delete().catch(() => null);

      // 元メッセージが見つからない時(再起動直後とか)はtextから作り直す
      let emb = old?.embeds;
      let cmp = old?.components;
      if (!old) {
        emb = [new EmbedBuilder().setColor('#5865F2').setDescription(sk.text)];
        cmp = [];
        if (sk.roleId && sk.roleId !== 'none') {
          cmp.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ann_btn_add_${sk.roleId}`).setLabel('ロールを受け取る').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ann_btn_remove_${sk.roleId}`).setLabel('ロールを解除する').setStyle(ButtonStyle.Danger)
          ));
        }
      }

      // 貼り直しは通知なし
      const nw = await message.channel.send({ embeds: emb, components: cmp, flags: MessageFlags.SuppressNotifications });
      sk.messageId = nw.id;
      st.saveLater(message.guild);
    } catch (e) {
      console.error(e);
    }
  },
};
