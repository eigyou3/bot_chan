const { SlashCommandBuilder } = require('discord.js');
const gn = require('../utils/gnews');
const { GI } = require('../utils/gi');

module.exports = {
  guild: GI,
  data: new SlashCommandBuilder().setName('setgenshinnews').setDescription('このチャンネルに原神のお知らせ（イベント・祈願）を流す'),
  execute: i => gn.set(i),
};
