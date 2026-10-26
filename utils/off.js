const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const st = require('./store');
const { isAdmin, deny } = require('./perm');

const box = t => ({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(t)] });
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const chName = (g, id) => g.channels.cache.get(id)?.name || '不明なチャンネル';

// /alarm-off
async function alarm(i) {
  if (!isAdmin(i)) return deny(i);
  const al = st.get(i.guildId).alarms;
  if (!al.length) return i.reply({ ...box('このサーバーにアラームはないよ。'), ephemeral: true });

  const menu = new StringSelectMenuBuilder().setCustomId('off_al').setPlaceholder('解除するアラームを選ぶ（複数OK）')
    .setMinValues(1).setMaxValues(Math.min(al.length, 25))
    .addOptions(al.slice(0, 25).map((a, n) => ({ label: `${a.time}　#${cut(chName(i.guild, a.ch), 40)}`, description: cut(a.msg, 90), value: String(n) })));
  return i.reply({ ...box('どのアラームを解除する？'), components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
}

// /announce-off
async function ann(i) {
  if (!isAdmin(i)) return deny(i);
  const sk = st.get(i.guildId).sticky;
  const ks = Object.keys(sk);
  if (!ks.length) return i.reply({ ...box('このサーバーに常駐してるアナウンスはないよ。'), ephemeral: true });

  const menu = new StringSelectMenuBuilder().setCustomId('off_sk').setPlaceholder('常駐を解除するアナウンスを選ぶ（複数OK）')
    .setMinValues(1).setMaxValues(Math.min(ks.length, 25))
    .addOptions(ks.slice(0, 25).map(c => ({ label: `#${cut(chName(i.guild, c), 90)}`, description: cut(sk[c].text, 90) || '（本文なし）', value: c })));
  return i.reply({ ...box('どのアナウンスの常駐を解除する？\nメッセージは消さずに、普通の投稿として残るよ。'), components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
}

// メニューで選んだ後
async function pick(i) {
  if (!isAdmin(i)) return deny(i);
  const d = st.get(i.guildId);

  if (i.customId === 'off_al') {
    // 後ろから消す（番号がずれないように）
    const ns = i.values.map(Number).sort((a, b) => b - a);
    const gone = ns.map(n => d.alarms[n]).filter(Boolean);
    for (const n of ns) d.alarms.splice(n, 1);
    await st.save(i.guild);
    return i.update({ ...box(`⏰ ${gone.length}件のアラームを解除したよ。\n${gone.map(a => `・${a.time}　${cut(a.msg, 40)}`).join('\n')}`), components: [] });
  }

  if (i.customId === 'off_sk') {
    for (const c of i.values) delete d.sticky[c];
    await st.save(i.guild);
    return i.update({ ...box(`📌 ${i.values.length}件の常駐を解除したよ。\n${i.values.map(c => `・<#${c}>`).join('\n')}`), components: [] });
  }
}

module.exports = { alarm, ann, pick };
