const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown, InteractionContextType } = require('discord.js');
const { isOwner, deny } = require('../utils/perm');

function pages(guilds) {
  const list = [...guilds.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
  const result = [];
  let text = '';
  for (const [index, g] of list.entries()) {
    const name = escapeMarkdown((g.name || '名前を取得できないサーバー').replace(/[\r\n]/g, ' '));
    const line = `${index + 1}. **${name}**\nID: \`${g.id}\`\n\n`;
    if (text.length + line.length > 3800) { result.push(text); text = ''; }
    text += line;
  }
  result.push(text || '参加しているサーバーはありません。');
  return result.map((description, index) => new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`参加サーバー一覧：${list.length}件`)
    .setDescription(description)
    .setFooter({ text: `${index + 1} / ${result.length}ページ` }));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('Botが参加しているサーバーの一覧を表示します（Bot管理者専用）')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(i, client) {
    if (!isOwner(i)) return deny(i);
    await i.deferReply();
    const embeds = pages(client.guilds.cache);
    await i.editReply({ content: `<@${i.user.id}> が参加サーバー一覧を確認`, embeds: [embeds[0]], allowedMentions: { parse: [] } });
    for (const embed of embeds.slice(1)) await i.followUp({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
