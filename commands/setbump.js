const { SlashCommandBuilder } = require('discord.js');
const bump = require('../utils/bump');

module.exports = {
  data: new SlashCommandBuilder().setName('setbump').setDescription('このチャンネルでDISBOARDのbumpをリマインドする')
    .addBooleanOption(o => o.setName('here').setDescription('通知時に@hereを付ける（初回の省略時はOFF）').setRequired(false)),
  execute: i => bump.set(i),
};
