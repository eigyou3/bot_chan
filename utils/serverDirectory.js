const { EmbedBuilder, escapeMarkdown, PermissionFlagsBits } = require('discord.js');
const st = require('./store');

const clean = s => escapeMarkdown(String(s || '不明').replace(/[\r\n]/g, ' '));
const userTag = id => id ? `<@${id}> (\`${id}\`)` : '取得不可';
const inviteUrl = invites => {
  const all = [...(invites?.values?.() || [])];
  const valid = all.filter(x => x.code && (!x.expiresAt || x.expiresAt.getTime() > Date.now()) && (!x.maxUses || x.uses < x.maxUses));
  return valid.length ? `https://discord.gg/${valid[0].code}` : null;
};

async function info(guild) {
  // ownerId is available without privileged member/presence intents.
  const ownerId = guild.ownerId || null;
  let invite = null;
  try {
    const me = guild.members.me || await guild.members.fetchMe();
    if (me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      invite = inviteUrl(await guild.invites.fetch());
    }
  } catch (e) {
    console.warn('既存招待の取得をスキップ:', guild.id, e.message);
  }
  return { name: guild.name, id: guild.id, ownerId, invite };
}

function makePages(items) {
  const pieces = [];
  let s = '';
  for (const [index, g] of items.entries()) {
    const line = `${index+1}. **${clean(g.name)}**\nサーバーID: \`${g.id}\`\n所有者: ${userTag(g.ownerId)}\n招待: ${g.invite || '取得不可'}\n\n`;
    if (s && s.length + line.length > 3700) { pieces.push(s); s = ''; }
    s += line;
  }
  pieces.push(s || '参加しているサーバーはありません。');
  return pieces.map((description,index) => new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`参加サーバー一覧：${items.length}件`)
    .setDescription(description)
    .setFooter({text:`${index+1} / ${pieces.length}ページ`}));
}

async function notifyJoin(guild) {
  const targets = [...guild.client.guilds.cache.values()].filter(g => g.id !== guild.id && st.get(g.id).serverJoinNotifyChannelId);
  for (const home of targets) {
    const id = st.get(home.id).serverJoinNotifyChannelId;
    const ch = await home.channels.fetch(id).catch(() => null);
    if (!ch?.isTextBased?.() || !ch.send) continue;
    const data = await info(guild);
    const embed = new EmbedBuilder().setColor('#57A773').setTitle('🆕 Botが新しいサーバーに導入されました')
      .setDescription(`**${clean(data.name)}**\nサーバーID: \`${data.id}\`\n所有者: ${userTag(data.ownerId)}\n招待: ${data.invite || '取得不可'}`);
    await ch.send({embeds:[embed],allowedMentions:{parse:[]}}).catch(e => console.error('導入通知の送信失敗:',home.id,e.message));
  }
}

module.exports={ info, makePages, notifyJoin, inviteUrl };
