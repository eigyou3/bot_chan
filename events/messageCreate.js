const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const st = require('../utils/store');

const NOTIFY_ROLE_ID = '1496147336043298866';

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;

    // --- 1. 来場予約の処理 ---
    // 時間（HH:MM形式）と様/さんが含まれる場合に反応
    const hasTimeAndName =
      /[\d０-９]{1,2}[：:][\d０-９]{2}/.test(message.content) &&
      /様|さん/.test(message.content);

    if (hasTimeAndName) {
      const { parseVisitorMessage, generateWelcomeImage } = require('../utils/imageGenerator');
      const parsed = parseVisitorMessage(message.content);

      if (parsed) {
        try {
          const buffer = await generateWelcomeImage(parsed, 1920, 1080);
          const file = new AttachmentBuilder(buffer, { name: 'welcome.jpg' });

          const member = message.member;
          const roleColor = member?.roles?.color?.hexColor ?? '#808080';

          const names = parsed.guests.map(g => g.name).join('・');

          const embed = new EmbedBuilder()
            .setColor(roleColor)
            .setDescription(
              `<@${message.author.id}> ！\n` +
              `${names}のウェルカムを作成したよ！\n\n` +
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

      const nw = await message.channel.send({ embeds: emb, components: cmp });
      sk.messageId = nw.id;
      st.saveLater(message.guild);
    } catch (e) {
      console.error(e);
    }
  },
};
