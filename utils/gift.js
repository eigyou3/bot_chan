const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const st = require('./store');

const COLOR = '#BA7517';
const URL = 'https://genshin.hoyoverse.com/ja/gift?code=';
const busy = new Map();

// 案内（ボタン付き）
function panel() {
  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('🎁 ギフトコード共有')
    .setDescription('見つけたコードはここからみんなに共有してね\n押すだけで交換ページに飛べるリンクになります');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gift_open').setLabel('ギフトコードを入力する').setStyle(ButtonStyle.Primary)
  );
  return { embeds: [e], components: [row] };
}

// 案内を置く（前のは消す）
async function place(ch) {
  const d = st.get(ch.guildId);
  if (d.giftP?.msg) await ch.messages.delete(d.giftP.msg).catch(() => null);
  const m = await ch.send({ ...panel(), flags: MessageFlags.SuppressNotifications });
  d.giftP = { ch: ch.id, msg: m.id };
  st.saveLater(ch.guild, 3000);
}

// 一番下に戻す
async function bump(ch) {
  const p = st.get(ch.guildId).giftP;
  if (!p || p.ch !== ch.id || busy.get(ch.id)) return;
  busy.set(ch.id, true);
  try {
    await place(ch);
  } finally {
    busy.set(ch.id, false);
  }
}

// ボタン → フォーム
function open(i) {
  const m = new ModalBuilder().setCustomId('gift_mdl').setTitle('ギフトコード');
  m.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('codes').setLabel('コード（複数OK・改行やスペース区切り）')
      .setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)
  ));
  return i.showModal(m);
}

// 全角→半角、大文字にそろえて分ける
function split(t) {
  const s = t.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
  const ok = [], ng = [];
  for (const w of s.split(/[\s,、]+/).filter(Boolean)) {
    const c = w.toUpperCase();
    // コードは英数字だけ、長さは6〜20
    if (/^[A-Z0-9]{6,20}$/.test(c)) { if (!ok.includes(c)) ok.push(c); }
    else ng.push(w);
  }
  return { ok, ng };
}

// フォーム送信 → 共有
async function submit(i) {
  await i.deferUpdate();
  const { ok, ng } = split(i.fields.getTextInputValue('codes'));

  if (ok.length) {
    const e = new EmbedBuilder()
      .setColor(COLOR)
      .setDescription(`<@${i.user.id}> がギフトコードを共有\n## 🎁 ギフトコード ${ok.length}件\n` + ok.map(c => `・[${c}](${URL}${c})`).join('\n'))
      .setFooter({ text: 'コードを押すと交換ページが開きます（要ログイン）' });
    const m = await i.channel.send({ content: '@everyone', embeds: [e], allowedMentions: { parse: ['everyone'] } });
    await m.react('❤️').catch(() => null);
  }

  // 弾いたものは本人にだけ
  if (ng.length) {
    const e = new EmbedBuilder().setColor('#5F5E5A')
      .setDescription(`コードじゃなさそうなので外したよ\n${ng.map(w => `・\`${w.slice(0, 40)}\``).join('\n')}`);
    await i.followUp({ embeds: [e], ephemeral: true }).catch(() => null);
  }

  if (ok.length) await bump(i.channel);
}

module.exports = { place, bump, open, submit, split };
