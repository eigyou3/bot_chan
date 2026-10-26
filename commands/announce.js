const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, FileUploadBuilder } = require('discord.js');
const { isAdmin, deny } = require('../utils/perm');

// モーダル送信まで選んだロールを覚えとく
const pend = new Map();

const cmd = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('アナウンスを送信（文章はポップアップで入力）')
  // stickyは見落とさないよう一番上
  .addBooleanOption(o => o.setName('sticky').setDescription('最下行に常駐（固定）させるか（デフォルト: いいえ）').setRequired(false));
for (let i = 1; i <= 5; i++) {
  cmd.addRoleOption(o => o.setName(`role${i}`).setDescription(`付与・解除させたいロール${i}（空欄ならなし）`).setRequired(false));
}

module.exports = {
  data: cmd,
  pend,

  async execute(interaction) {
    if (!isAdmin(interaction)) return deny(interaction);

    const ids = [];
    for (let i = 1; i <= 5; i++) {
      const r = interaction.options.getRole(`role${i}`);
      if (r && !ids.includes(r.id)) ids.push(r.id);
    }
    pend.set(interaction.id, { ids, sticky: interaction.options.getBoolean('sticky') || false });
    setTimeout(() => pend.delete(interaction.id), 15 * 60000);

    const modal = new ModalBuilder()
      .setCustomId(`ann_mdl_${interaction.id}`)
      .setTitle('アナウンス内容の入力');

    // 文章と画像（画像はなくてもOK）
    const txt = new LabelBuilder().setLabel('案内文章（ここで普通に改行できます）')
      .setTextInputComponent(new TextInputBuilder().setCustomId('announce_text').setStyle(TextInputStyle.Paragraph).setRequired(true));
    const img = new LabelBuilder().setLabel('画像（なくてもOK）')
      .setFileUploadComponent(new FileUploadBuilder().setCustomId('announce_img').setRequired(false).setMaxValues(1));

    modal.addLabelComponents(txt, img);
    return interaction.showModal(modal);
  },
};
