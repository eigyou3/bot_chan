const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { isOwner, deny } = require('../utils/perm');
const st = require('../utils/store');
const directory = require('../utils/serverDirectory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('Bot参加サーバーと所有者・招待リンクを表示（管理者専用）')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(i, client) {
    if (!isOwner(i)) return deny(i);
    await i.deferReply();

    // A guild text channel where /servers is invoked becomes the notification target.
    // Bot DMs cannot be used for automatic join notifications.
    let saved = null;
    if (i.guild && i.channel?.isTextBased?.()) {
      const cfg = st.get(i.guild.id);
      cfg.serverJoinNotifyChannelId = i.channelId;
      saved = await st.save(i.guild);
    }
    const list = [...client.guilds.cache.values()].sort((a,b) => (a.name || '').localeCompare(b.name || '', 'ja'));
    const data = await Promise.all(list.map(directory.info));
    const embeds = directory.makePages(data);
    const notice = i.guild
      ? saved ? '\n🔔 今後の導入通知先：このチャンネル' : '\n⚠️ 通知先の保存に失敗。#bot-config とBotの権限を確認してください。'
      : '\nℹ️ DMでの実行では通知先を登録できません。サーバー内のチャンネルで実行してください。';
    await i.editReply({content:`<@${i.user.id}> が参加サーバー一覧を確認${notice}`,embeds:[embeds[0]],allowedMentions:{parse:[]}});
    for (const embed of embeds.slice(1)) await i.followUp({embeds:[embed],allowedMentions:{parse:[]}});
  },
};
