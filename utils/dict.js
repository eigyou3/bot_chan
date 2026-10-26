const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

// 住宅用語辞典（サイトと同じスプレッドシートを読む）
const GAS = 'https://script.google.com/macros/s/AKfycbxOpUGuZVsAbdXp414f2HJySNvjALJrkxaFq2g-BpqU1MXtdoBRpBymRGP9jQxW__Oo/exec';
const IMG = 'https://komai-home.co.jp/images/tools/housing-dictionary/';
const COLOR = '#E8833A';

let terms = [], at = 0;

// 10分キャッシュ
async function load() {
  if (terms.length && Date.now() - at < 600000) return terms;
  try {
    const d = await fetch(GAS).then(r => r.json());
    if (Array.isArray(d)) { terms = d.filter(t => t.name); at = Date.now(); }
  } catch (e) {
    console.error('辞典の読み込み失敗:', e.message);
  }
  return terms;
}

// 全角半角・カタカナ・大小をそろえる
const nz = s => String(s || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/\s+/g, '');

// 「〜ってなに？」みたいなのを落とす
const strip = s => s.replace(/(って|とは|は)?(なに|何|なん|どういう(意味|こと)?|教えて|おしえて|について|の意味|意味)?[?？!！。、\s]*$/u, '').trim();

const box = t => new EmbedBuilder().setColor(COLOR).setDescription(t);

function card(t) {
  const e = new EmbedBuilder().setColor(COLOR).setTitle(t.name);
  const head = [t.ruby && `よみ：${t.ruby}`, t.cat && String(t.cat).split(',').map(x => x.trim()).filter(Boolean).join('・')].filter(Boolean).join('　');
  const body = [head, String(t.desc || '').replace(/<br\s*\/?>/g, '\n')].filter(Boolean).join('\n\n');
  e.setDescription(body.slice(0, 4000) || '（説明なし）');
  if (t.example) e.addFields({ name: '例', value: String(t.example).slice(0, 1024) });
  if (t.discord) e.addFields({ name: '補足', value: String(t.discord).slice(0, 1024) });
  if (t.img) e.setImage(IMG + encodeURIComponent(t.img));
  else if (t.video) e.addFields({ name: '動画', value: `[再生する](${IMG}${encodeURIComponent(t.video)})` });
  return e;
}

function find(q) {
  const k = nz(strip(q));
  if (!k) return [];
  const N = t => nz(t.name), R = t => nz(t.ruby);

  // 1. ぴったり
  const ex = terms.filter(t => N(t) === k || (t.ruby && R(t) === k));
  if (ex.length) return ex;

  // 2. 文の中に用語が入ってる（長いのを優先）
  const inq = terms.filter(t => k.includes(N(t)) || (t.ruby && R(t).length > 1 && k.includes(R(t))))
    .sort((a, b) => N(b).length - N(a).length);
  if (inq.length) return [inq[0], ...inq.slice(1).filter(t => N(t).length === N(inq[0]).length)];

  // 3. 用語の一部
  const part = terms.filter(t => N(t).includes(k) || (t.ruby && R(t).includes(k)));
  if (part.length) return part;

  // 4. 説明や補足に出てくる
  return terms.filter(t => nz(t.desc).includes(k) || nz(t.discord).includes(k));
}

async function answer(ch, uid, q) {
  await load();
  if (!terms.length) return ch.send({ embeds: [box('今、辞典が読み込めなかったよ。少し待ってからもう一度聞いてね。')] });

  const hit = find(q);
  if (!hit.length) return ch.send({ embeds: [box(`「${strip(q).slice(0, 50)}」は辞典にまだ載ってないよ。`)] });
  if (hit.length === 1) return ch.send({ embeds: [card(hit[0])] });

  // 何件か当たったら選んでもらう（聞いた人だけ選べる）
  const menu = new StringSelectMenuBuilder().setCustomId(`dic_${uid}`).setPlaceholder('どれのこと？')
    .addOptions(hit.slice(0, 25).map((t, i) => ({ label: String(t.name).slice(0, 100), description: t.ruby ? String(t.ruby).slice(0, 100) : undefined, value: String(i) })));
  const m = await ch.send({ embeds: [box(`${hit.length > 25 ? '25件以上' : hit.length + '件'}見つかったよ。どれのこと？`)], components: [new ActionRowBuilder().addComponents(menu)] });
  pend.set(m.id, hit.slice(0, 25));
  setTimeout(() => pend.delete(m.id), 10 * 60000);
}

const pend = new Map();

async function pick(i) {
  if (i.customId !== `dic_${i.user.id}`) return i.reply({ embeds: [box('これは聞いた人だけ選べるよ。')], ephemeral: true });
  const hit = pend.get(i.message.id);
  const t = hit?.[+i.values[0]];
  if (!t) return i.update({ embeds: [box('時間が経ったので、もう一度聞いてね。')], components: [] });
  pend.delete(i.message.id);
  return i.update({ embeds: [card(t)], components: [] });
}

// メンションされた時
async function onMention(msg, client) {
  const q = msg.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  if (q) return answer(msg.channel, msg.author.id, q);

  // 空メンション → 聞き返して次の発言を待つ
  await msg.channel.send({ embeds: [box('なにが聞きたいですか？')] });
  const got = await msg.channel.awaitMessages({ filter: m => m.author.id === msg.author.id, max: 1, time: 120000 }).catch(() => null);
  const n = got?.first();
  if (!n) return;
  const q2 = n.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  if (q2) return answer(msg.channel, msg.author.id, q2);
}

module.exports = { onMention, pick, find, load, strip, nz, _set: d => { terms = d; at = Date.now(); } };
