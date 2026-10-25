const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const st = require('../utils/store');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    if (!newState.channelId) return;
    if (oldState.channelId === newState.channelId) return;

    const vcChannel = newState.channel;
    if (!vcChannel || vcChannel.members.size !== 1) return;

    const notifyChannelId = st.get(newState.guild.id).vc;
    if (!notifyChannelId) return;

    const notifyChannel = newState.guild.channels.cache.get(notifyChannelId);
    if (!notifyChannel) return;

    const member = newState.member;
    const roleColor = member?.roles?.color?.hexColor ?? '#5865F2';

    const embed = new EmbedBuilder()
      .setColor(roleColor)
      .setAuthor({
        name: member.displayName,
        iconURL: member.user.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(`<@${member.id}> が **🔊 ${vcChannel.name}** で通話を始めました！\n気軽に参加してね！`)
      .setTimestamp();

    const vcRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('通話に参加する')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${newState.guild.id}/${newState.channelId}`)
    );

    await notifyChannel.send({ embeds: [embed], components: [vcRow] }).catch(e => console.error('VC通知失敗:', e.message));
  },
};
