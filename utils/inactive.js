const { EmbedBuilder, PermissionFlagsBits: P } = require('discord.js');
const st = require('./store');
const { isOwner } = require('./perm');
const DAY = 86400000, GRACE = 7 * DAY;
const running = new Set(), flush = new Map();

// 月末は移動先の月末に丸める。日時は日本時間で扱う。
function threeMonths(at) {
  const d = new Date(at + 9 * 3600000);
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 3);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return d.getTime() - 9 * 3600000;
}

function record(guild, user, at = Date.now()) {
  const s = st.get(guild.id).inactive;
  if (!s?.enabled || user.bot) return;
  const u = s.users[user.id] ||= {};
  u.at = Math.max(u.at || 0, at);
  delete u.warningAt; delete u.dmFailedAt;
  if (!flush.has(guild.id)) {
    const t = setTimeout(() => { flush.delete(guild.id); st.save(guild); }, 60000);
    t.unref?.(); flush.set(guild.id, t);
  }
}

function eligible(member, s, now) {
  if (member.user.bot || member.id === member.guild.ownerId || isOwner(member) || member.permissions.has(P.Administrator)) return false;
  if (s.exclude && member.roles.cache.has(s.exclude)) return false;
  if (!member.joinedTimestamp || member.voice?.channelId || !member.kickable) return false;
  const u = s.users[member.id] || {};
  return now >= threeMonths(Math.max(s.since, member.joinedTimestamp, u.at || 0));
}

async function log(guild, s, text) {
  const ch = guild.channels.cache.get(s.log);
  if (!ch) throw new Error('活動監視のログ送信先がありません');
  await ch.send({ embeds: [new EmbedBuilder().setColor('#BA7517').setTitle('非アクティブ管理').setDescription(text)], allowedMentions: { parse: [] } });
}

async function persist(guild, s) {
  if (await st.save(guild)) return true;
  s.enabled = false;
  await log(guild, s, '⚠️ 設定を保存できないため、自動キックを停止しました。#bot-config を確認してから再度有効化してください。').catch(() => null);
  return false;
}

async function sweep(guild, now = Date.now()) {
  const s = st.get(guild.id).inactive;
  if (!s?.enabled || running.has(guild.id)) return;
  running.add(guild.id);
  try {
    // 記録していない時間を「活動なし」とみなさない。
    if (now - s.seenAt > 15 * 60000) {
      s.since = now;
      for (const u of Object.values(s.users)) { delete u.warningAt; delete u.dmFailedAt; }
      await log(guild, s, 'Botが15分以上活動を確認できなかったため、判定期間を今日から3か月にリセットしました。');
    }
    s.seenAt = now;
    if (!await persist(guild, s)) return;
    if (now - (s.checkedAt || 0) < 3600000) return;
    // ログが送れない状態では警告・キックを進めない。
    const channel = guild.channels.cache.get(s.log);
    if (!channel?.permissionsFor(guild.members.me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) return;
    const members = await guild.members.fetch();
    for (const m of members.values()) if (!m.user.bot && m.voice?.channelId) record(guild, m.user, now);
    for (const m of members.values()) {
      if (!s.enabled) break;
      if (!eligible(m, s, now)) {
        if (s.users[m.id]) delete s.users[m.id].warningAt;
        continue;
      }
      const u = s.users[m.id] ||= {};
      if (!u.warningAt) {
        if (u.dmFailedAt && now - u.dmFailedAt < DAY) continue;
        const observed = u.at || 0;
        try {
          await m.send({ embeds: [new EmbedBuilder().setColor('#BA7517').setTitle(`${guild.name}：非アクティブによる退出予告`).setDescription(`3か月間、発言・VC参加を確認できていません。\n<t:${Math.floor((now + GRACE) / 1000)}:F>以降にキックの対象になります。\nそれまでにサーバーで発言するか、VCに参加すると解除されます。\nBotが閲覧できない場所での活動は確認できません。事情がある場合はサーバー管理者にご連絡ください。`)], allowedMentions: { parse: [] } });
        } catch {
          u.dmFailedAt = now;
          await log(guild, s, `<@${m.id}>：警告DMを送信できないため、キックしません。管理者による確認が必要です。`);
          if (!await persist(guild, s)) return;
          continue;
        }
        // DM送信待ちの間に活動した場合は警告状態を付けない。
        if ((u.at || 0) !== observed) continue;
        u.warningAt = now; delete u.dmFailedAt;
        if (!await persist(guild, s)) return;
        await log(guild, s, `<@${m.id}> に警告DMを送りました。7日間活動がなければキックします。`);
        continue;
      }
      if (now < u.warningAt + GRACE) continue;
      // 直前の再取得後も、除外・参加日・VC・最新の発言時刻を再判定する。
      const fresh = await guild.members.fetch({ user: m.id, force: true }).catch(() => null);
      if (!fresh || !s.enabled || !u.warningAt || !eligible(fresh, s, Date.now())) continue;
      if (!await persist(guild, s)) return;
      if (!s.enabled || !u.warningAt || !eligible(fresh, s, Date.now())) continue;
      await log(guild, s, `<@${m.id}>：3か月活動なし・警告後7日経過のためキックを実行します。`);
      // ログ送信待ち中の活動も確認する。
      if (!s.enabled || !u.warningAt || !eligible(fresh, s, Date.now())) continue;
      try {
        await fresh.kick('3か月発言・VC参加なし。警告DM送信後7日間活動なし。');
        delete s.users[m.id];
        await log(guild, s, `<@${m.id}> をキックしました。`);
      } catch (e) { await log(guild, s, `<@${m.id}> のキックに失敗しました：${e.message.slice(0, 200)}`); }
      if (!await persist(guild, s)) return;
    }
    s.checkedAt = now;
    await persist(guild, s);
  } finally { running.delete(guild.id); }
}

async function tick(client) {
  for (const g of client.guilds.cache.values()) {
    if (!st.get(g.id).inactive?.enabled) continue;
    await sweep(g).catch(e => console.error(`非アクティブ管理エラー ${g.id}:`, e.message));
  }
}
module.exports = { threeMonths, record, eligible, sweep, tick };
