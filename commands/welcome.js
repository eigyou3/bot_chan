const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { generateWelcomeImage } = require('../utils/imageGenerator.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('ウェルカム画像を自動生成して送信します')
    .addStringOption(o => o.setName('date').setDescription('日付（例: 06/20）').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('時間（例: 13:30）').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('お名前（例: 井上）').setRequired(true))
    .addStringOption(o => o.setName('text').setDescription('任意の追加テキスト（なければ空欄）').setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply();

    const date = interaction.options.getString('date');
    const time = interaction.options.getString('time');
    const name = interaction.options.getString('name');
    const extraText = interaction.options.getString('text') || '';

    // 年を自動取得してフォーマットを整える
    const currentYear = new Date().getFullYear();
    const formattedDate = date.includes('/') ? `${currentYear}/${date}` : `${currentYear}/${date.replace(/[^\d]/g, '/')}`;

    const parsedData = {
      date: formattedDate,
      time: time,
      name: name,
      extraText: extraText
    };

    try {
      const imageBuffer = await generateWelcomeImage(parsedData);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.jpg' });

      const roleColor = interaction.member?.roles?.color?.hexColor ?? '#5865F2';
      const embed = new EmbedBuilder()
        .setColor(roleColor)
        .setDescription(`📢 **${parsedData.date} ${parsedData.time} ${parsedData.name}様** のウェルカム画像を作成したよ！\nみんなにも共有しておくね！`)
        .setImage('attachment://welcome.jpg');

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ 画像の生成中にエラーが発生しました。', ephemeral: true });
    }
  },
};
