const { done } = require('../utils/feedback');
const { SlashCommandBuilder } = require('discord.js');
const st = require('../utils/store');
const { isAdmin, deny } = require('../utils/perm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setvc')
    .setDescription('このチャンネルをVC参加の通知先に設定します'),

  async execute(interaction) {
    if (!isAdmin(interaction)) return deny(interaction);

    const g = interaction.guild;
    st.get(g.id).vc = interaction.channelId;
    await interaction.deferReply({ ephemeral: true });
    await st.save(g);
    return done(interaction, `✅ VC参加の通知先をこのチャンネル（ <#${interaction.channelId}> ）に設定しました。${st.warn(g)}`);
  },
};
