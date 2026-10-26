const { EmbedBuilder } = require('discord.js');
const st = require('./store');
const { isAdmin, deny } = require('./perm');

// DISBOARDのbumpリマインド
const DIS = '302050872383242240';
const WAIT = 2 * 60 * 60;  // 2時間
const COLOR = '#5F5E5A';

const box = t => new EmbedBuilder().setColor(COLOR).setDescription(t);

// DISBOARDの「表示順をアップしたよ」
function isBump(m) {
  if (m.author?.id !== DIS) return false;
  const t = m.embeds?.map(e => `${e.description || ''} ${e.title || ''}`).join(' ') || '';
  return /アップしたよ|Bump done/i.test(t);
}

const who = m => m.interactionMetadata?.user?.id || m.interaction?.user?.id || null;

// 前のカウント/リマインドを消して、新しいのを出す
async function put(ch, b, opt) {
  if (b.msg) await ch.messages.delete(b.msg).catch(() => null);
  const m = await ch.send(opt).catch(e => { console.error('bump投稿失敗:', e.message); return null; });
  b.msg = m?.id || null;
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
  // 別のチャンネルから移す時は前の投稿を消す
  if (d.bump?.ch && d.bump.ch !== i.channelId && d.bump.msg) {
    await i.guild.channels.cache.get(d.bump.ch)?.messages.delete(d.bump.msg).catch(() => null);
  }
  const b = d.bump = { ch: i.channelId, msg: d.bump?.ch === i.channelId ? d.bump.msg : null, at: null, rem: false };

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
  } else {
    b.rem = true;
    await put(i.channel, b, { embeds: [box('まだbumpの記録がないよ。`/bump` してね')] });
  }

  await st.save(i.guild);
  return i.editReply({ embeds: [box(`✅ このチャンネルでbumpのリマインドをするよ。\n時間になったら @here で知らせるね。${st.warn(i.guild)}`)] });
}

// 毎分：時間になったらリマインド
async function tick(client) {
  const now = Date.now() / 1000;
  for (const g of client.guilds.cache.values()) {
    const b = st.get(g.id).bump;
    if (!b?.ch || !b.at || b.rem) continue;
    if (now < Math.floor(b.at / 1000) + WAIT) continue;
    const ch = g.channels.cache.get(b.ch);
    if (!ch) continue;
    b.rem = true;
    await put(ch, b, { content: '@here', embeds: [box('bumpできるよ！ `/bump` してね')], allowedMentions: { parse: ['everyone'] } });
    await st.save(g);
  }
}

module.exports = { set, on, tick, isBump };
