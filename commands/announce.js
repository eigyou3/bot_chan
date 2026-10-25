const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { isAdmin, deny } = require('../utils/perm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('アナウンスを送信（文章はポップアップで入力）')
    .addRoleOption(o => o.setName('role').setDescription('付与・解除させたいロール（空欄ならボタンなし）').setRequired(false))
    .addBooleanOption(o => o.setName('sticky').setDescription('最下行に常駐（固定）させるか（デフォルト: いいえ）').setRequired(false)),

  async execute(interaction) {
    if (!isAdmin(interaction)) return deny(interaction);

    const role = interaction.options.getRole('role');
    const sticky = interaction.options.getBoolean('sticky') || false;

    const modal = new ModalBuilder()
      .setCustomId(`ann_mdl_${role ? role.id : 'none'}_${sticky ? '1' : '0'}`)
      .setTitle('アナウンス内容の入力');

    const txt = new TextInputBuilder()
      .setCustomId('announce_text')
      .setLabel('案内文章（ここで普通に改行できます）')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(txt));
    return interaction.showModal(modal);
  },
};
