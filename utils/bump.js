const { EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const st = require('./store');
const { isAdmin, deny } = require('./perm');

// DISBOARDのbumpリマインド
const DIS = '302050872383242240';
const WAIT = 2 * 60 * 60;  // 2時間
const COLOR = '#5F5E5A';
const busy = new Set();

const box = t => new EmbedBuilder().setColor(COLOR).setDescription(t);

// DISBOARDの「表示順をアップしたよ」
function isBump(m) {
  if (m.author?.id !== DIS) return false;
  const t = m.embeds?.map(e => `${e.description || ''} ${e.title || ''}`).join(' ') || '';
  return /アップしたよ|Bump done/i.test(t);
}

const who = m => m.interactionMetadata?.user?.id || m.interaction?.user?.id || null;

// 既存の案内を編集する。消えている場合だけ通知音なしで投稿する。
async function put(ch, b, opt, notify = false) {
  const payload = { content: notify ? '@here' : '', ...opt, allowedMentions: { parse: notify ? ['everyone'] : [] } };
  const old = b.msg && await ch.messages.fetch(b.msg).catch(() => null);
  if (!notify && old && await old.edit(payload).catch(() => null)) return true;
  // メッセージ編集ではメンション通知されないため、ONの場合だけ新規投稿。
  const m = await ch.send({ ...payload, ...(!notify ? { flags: MessageFlags.SuppressNotifications } : {}) }).catch(e => { console.error('bump投稿失敗:', e.message); return null; });
  if (!m) return false;
  b.msg = m.id;
  if (old) await old.delete().catch(() => null);
  return true;
}

function countMsg(at, uid) {
  const n = Math.floor(at / 1000) + WAIT;
  return { embeds: [box(`${uid ? `<@${uid}> がbumpしてくれたよ！\n` : ''}次にbumpできるのは <t:${n}:R>（<t:${n}:t>）`)], allowedMentions: { parse: [] } };
}

// bumpされた時
async function on(m) {
  const d = st.get(m.guildId);
  const b = d.bump;
  if (!b?.ch || b.ch !== m.channelId || !isBump(m)) return;
  b.at = m.createdTimestamp;
  b.rem = false;
  await put(m.channel, b, countMsg(b.at, who(m)));
  await st.save(m.guild);
}

// /setbump
async function set(i) {
  if (!isAdmin(i)) return deny(i);
  await i.deferReply({ ephemeral: true });
  const d = st.get(i.guildId);
  const here = i.options?.getBoolean('here') ?? d.bump?.here ?? false;
  if (here && !i.channel.permissionsFor(i.guild.members.me)?.has(PermissionFlagsBits.MentionEveryone)) {
    return i.editReply('⚠️ @hereを付けるには、このチャンネルでBotの「@everyone、@here、すべてのロールにメンション」権限を許可してください。通知なしにする場合は `/setbump here:False` を実行してください。');
  }
  // 別のチャンネルから移す時は前の投稿を消す
  if (d.bump?.ch && d.bump.ch !== i.channelId && d.bump.msg) {
    await i.guild.channels.cache.get(d.bump.ch)?.messages.delete(d.bump.msg).catch(() => null);
  }
  const previous = d.bump;
  const b = d.bump = { ch: i.channelId, msg: previous?.ch === i.channelId ? previous.msg : null, at: previous?.ch === i.channelId ? previous.at : null, rem: false, here };

  // 最後のbumpを履歴から探す
  const ms = await i.channel.messages.fetch({ limit: 100 }).catch(() => null);
  const last = ms && [...ms.values()].find(isBump);

  if (last) {
    b.at = last.createdTimestamp;
    if (Date.now() / 1000 >= Math.floor(b.at / 1000) + WAIT) {
      b.rem = true;
      await put(i.channel, b, { embeds: [box('bumpできるよ！ `/bump` してね')] });
    } else {
      await put(i.channel, b, countMsg(b.at, who(last)));
    }
  } else if (b.at && Date.now() / 1000 < Math.floor(b.at / 1000) + WAIT) {
    await put(i.channel, b, countMsg(b.at, null));
  } else {
    b.rem = true;
    await put(i.channel, b, { embeds: [box('まだbumpの記録がないよ。`/bump` してね')] });
  }

  if (!await st.save(i.guild)) return i.editReply(`⚠️ bumpの設定を保存できませんでした。${st.warn(i.guild)}\n/setup で保存先を確認してから再設定してください。`);
  return require('./feedback').done(i, { embeds: [box(`✅ このチャンネルでbumpの案内を表示するよ。\n@here通知：${here ? 'ON' : 'OFF（静かに更新）'}${st.warn(i.guild)}`)] });
}

// 毎分：時間になったらリマインド
async function tick(client) {
  const now = Date.now() / 1000;
  for (const g of client.guilds.cache.values()) {
    const b = st.get(g.id).bump;
    if (!b?.ch || !b.at || b.rem || busy.has(g.id)) continue;
    if (now < Math.floor(b.at / 1000) + WAIT) continue;
    const ch = g.channels.cache.get(b.ch);
    if (!ch) continue;
    busy.add(g.id);
    try {
      b.rem = await put(ch, b, { embeds: [box('bumpできるよ！ DISBOARDの `/bump` を実行してね')] }, b.here === true);
      await st.save(g);
    } finally { busy.delete(g.id); }
  }
}

module.exports = { set, on, tick, isBump };
