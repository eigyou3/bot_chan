const { SlashCommandBuilder, PermissionFlagsBits: P, ChannelType, EmbedBuilder, InteractionContextType } = require('discord.js');
const st = require('../utils/store');
const { isAdmin, deny } = require('../utils/perm');
const { eligible } = require('../utils/inactive');

module.exports = {
  data: new SlashCommandBuilder().setName('inactive').setDescription('3か月活動なし→警告DM→7日後の自動キックを管理します').setContexts(InteractionContextType.Guild)
    .addSubcommand(c => c.setName('enable').setDescription('発言・VC参加の監視と警告つき自動キックを有効化')
      .addChannelOption(o => o.setName('log').setDescription('管理者が確認するログ送信先').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addRoleOption(o => o.setName('exclude').setDescription('キック対象から除外するロール')))
    .addSubcommand(c => c.setName('disable').setDescription('監視と自動キックを停止'))
    .addSubcommand(c => c.setName('status').setDescription('監視設定を確認'))
    .addSubcommand(c => c.setName('check').setDescription('現在の非アクティブ候補を表示（キックしません）')),
  async execute(i) {
    if (!isAdmin(i)) return deny(i);
    await i.deferReply();
    const d = st.get(i.guildId), sub = i.options.getSubcommand();
    if (sub === 'enable') {
      const me = i.guild.members.me || await i.guild.members.fetchMe();
      if (!me.permissions.has(P.KickMembers)) return i.editReply('⚠️ Botに「メンバーをキック」権限が必要です。Botのロールより上位・同順位のメンバーは対象にできません。');
      const ch = i.options.getChannel('log');
      if (!ch.permissionsFor(me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) return i.editReply('⚠️ ログ送信先でBotの閲覧・送信・埋め込みリンクを許可してください。');
      const now = Date.now(), previous = d.inactive;
      const wasEnabled = previous?.enabled;
      if (previous) previous.enabled = false;
      d.inactive = { enabled: true, since: now, seenAt: now, checkedAt: 0, log: ch.id, exclude: i.options.getRole('exclude')?.id || null, users: {} };
      if (!await st.save(i.guild)) { d.inactive = previous; if (previous) previous.enabled = wasEnabled; return i.editReply('⚠️ 設定を保存できなかったため、新しい設定は有効化していません。#bot-config を確認してください。'); }
      return i.editReply({ embeds: [new EmbedBuilder().setColor('#BA7517').setTitle('非アクティブ管理を有効化しました').setDescription(`今日から記録を開始します。\n**3か月発言・VC参加なし → 警告DM → さらに7日間活動なしでキック**\n発言・VC参加があれば警告は解除されます。\nDMを送れない人はキックしません。\nBot・サーバー所有者・管理者・Bot管理者${d.inactive.exclude ? `・<@&${d.inactive.exclude}>` : ''}は対象外です。\nBotが閲覧できる場所の活動だけが記録対象です。\nBotが15分以上停止した場合、判定期間をリセットします。\nログ：<#${ch.id}>\n再度 enable を実行すると、全員の判定期間を今日から数え直します。`)], allowedMentions: { parse: [] } });
    }
    const s = d.inactive;
    if (sub === 'disable') {
      if (s) s.enabled = false;
      if (!await st.save(i.guild)) return i.editReply('⚠️ いまのBot上では停止しましたが、保存に失敗しました。再起動前に #bot-config を確認し、もう一度停止してください。');
      return i.editReply('非アクティブ管理を停止しました。自動キックは行いません。');
    }
    if (!s?.enabled) return i.editReply('非アクティブ管理はOFFです。`/inactive enable` で有効化できます。');
    if (sub === 'status') return i.editReply({ embeds: [new EmbedBuilder().setColor('#BA7517').setTitle('非アクティブ管理：ON').setDescription(`判定開始：<t:${Math.floor(s.since / 1000)}:F>\n3か月活動なし＋警告後7日でキック\nログ：<#${s.log}>\n除外ロール：${s.exclude ? `<@&${s.exclude}>` : 'なし'}\n警告中：${Object.values(s.users).filter(u => u.warningAt).length}人\n停止：/inactive disable`)], allowedMentions: { parse: [] } });
    const members = await i.guild.members.fetch();
    const ids = [...members.values()].filter(m => eligible(m, s, Date.now())).map(m => m.id);
    return i.editReply({ embeds: [new EmbedBuilder().setColor('#BA7517').setTitle(`非アクティブ候補：${ids.length}人`).setDescription(ids.length ? ids.slice(0, 80).map(id => `<@${id}>${s.users[id]?.warningAt ? '（警告済み）' : ''}`).join('\n') + (ids.length > 80 ? '\n※先頭80人を表示しています。' : '') : '現在、対象になる人はいません。').setFooter({ text: 'この確認コマンドではキックしません' })], allowedMentions: { parse: [] } });
  },
};
