const { EmbedBuilder } = require('discord.js');
const st = require('./store');

function payload(a) {
  const embed = new EmbedBuilder().setColor('#BA7517')
    .setTitle(`⏰ アラーム ${a.time}`)
    .setDescription(a.msg)
    .addFields({ name: '設定者', value: a.by ? `<@${a.by}>` : '未記録（/alarm で再設定すると記録されます）' })
    .setFooter({ text: '毎日繰り返し・日本時間' });
  if (a.by) embed.setAuthor({ name: `${a.byName || a.by} さんのアラーム`, ...(a.byAvatar ? { iconURL: a.byAvatar } : {}) });
  // 本文にもともと含まれていた通知先だけを本文側に残して通知する。
  // 設定者の表示はEmbed内なので、設定者に余分な通知は送らない。
  const mentions = [...new Set(a.msg.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || [])];
  return { embeds: [embed], ...(mentions.length ? { content: mentions.join(' ') } : {}), allowedMentions: { parse: ['users', 'roles', 'everyone'] } };
}

async function tick(client, now) {
  for (const d of st.db.values()) {
    for (const a of d.alarms) {
      if (a.time !== now) continue;
      const ch = await client.channels.fetch(a.ch).catch(() => null);
      if (ch) await ch.send(payload(a)).catch(e => console.error('アラーム送信エラー:', e.message));
    }
  }
}
module.exports = { payload, tick };
