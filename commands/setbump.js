const { SlashCommandBuilder } = require('discord.js');
const bump = require('../utils/bump');

module.exports = {
  data: new SlashCommandBuilder().setName('setbump').setDescription('このチャンネルでDISBOARDのbumpをリマインドする'),
  execute: i => bump.set(i),
};
