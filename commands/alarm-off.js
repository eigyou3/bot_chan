const { SlashCommandBuilder } = require('discord.js');
const off = require('../utils/off');

module.exports = {
  data: new SlashCommandBuilder().setName('alarm-off').setDescription('アラームを解除する'),
  execute: i => off.alarm(i),
};
