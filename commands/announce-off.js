const { SlashCommandBuilder } = require('discord.js');
const off = require('../utils/off');

module.exports = {
  data: new SlashCommandBuilder().setName('announce-off').setDescription('アナウンスの常駐を解除する'),
  execute: i => off.ann(i),
};
