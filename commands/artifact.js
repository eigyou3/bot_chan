const { SlashCommandBuilder } = require('discord.js');
const art = require('../utils/artifact');

// 原神サーバー専用
const GUILD = '1386706264578461726';

module.exports = {
  guild: GUILD,
  data: new SlashCommandBuilder()
    .setName('artifact')
    .setDescription('自慢の聖遺物を見せびらかす')
    .addStringOption(o => o.setName('base').setDescription('スコアの計算基準（デフォルト: 攻撃）').setRequired(false)
      .addChoices(...Object.entries(art.BASES).map(([k, b]) => ({ name: b.nm, value: k }))))
    .addStringOption(o => o.setName('uid').setDescription('UID（登録済みなら空欄でOK）').setRequired(false)),

  async execute(interaction) {
    if (interaction.guildId !== GUILD) {
      return interaction.reply({ content: '❌ このサーバーではこのコマンドを使用できません。', ephemeral: true });
    }
    return art.start(interaction, interaction.options.getString('base') || 'atk', interaction.options.getString('uid'));
  },
};
