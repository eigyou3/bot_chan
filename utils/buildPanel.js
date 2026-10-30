const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { randomBytes } = require('crypto');
const st = require('./store');
const en = require('./enka');
const art = require('./artifact');
const { GI } = require('./gi');
const sessions = new Map();
const locks = new Set();
const TTL = 14 * 60 * 1000;
const box = t => new EmbedBuilder().setColor('#8A8A8A').setDescription(t);
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...items) => new ActionRowBuilder().addComponents(...items);

function panel() {
  return { embeds: [box('## ビルドカード作成\n登録したUIDから、展示キャラクターのビルドカードを作成できます。\n作成方法を選んでね！')], components: [row(button('bc_open_score', 'スコア付きで作成', ButtonStyle.Primary), button('bc_open_plain', 'スコアなしで作成'))] };
}

// チャンネルごとに1枚。再投稿中の重複を防ぎ、生成カードの後にも移動する。
async function place(ch, create = false) {
  const d = st.get(ch.guildId);
  const panels = d.buildPanels ||= {};
  if ((!create && !panels[ch.id]) || locks.has(ch.id)) return;
  locks.add(ch.id);
  try {
    const old = panels[ch.id];
    const m = await ch.send({ ...panel(), flags: MessageFlags.SuppressNotifications, allowedMentions: { parse: [] } });
    panels[ch.id] = m.id;
    if (old) await ch.messages.delete(old).catch(() => null);
    st.saveLater(ch.guild, 3000);
  } finally { locks.delete(ch.id); }
}

async function start(i) {
  if (!GI.includes(i.guildId)) return i.reply({ content: 'このサーバーでは使用できません。', ephemeral: true });
  await i.deferReply({ ephemeral: true });
  await place(i.channel, true);
  const saved = await st.save(i.guild);
  if (!saved) return i.editReply('⚠️ 案内を設置しましたが設定を保存できませんでした。#bot-config とBotの権限を確認してください。');
  return i.deleteReply();
}

function controls(s) {
  const menu = new StringSelectMenuBuilder().setCustomId(`bc_char_${s.id}`).setPlaceholder('キャラクターを選択').addOptions(s.list.slice(0, 25).map(a => ({ label: s.names[a.avatarId] || `キャラ ${a.avatarId}`, value: String(a.avatarId), default: String(a.avatarId) === s.aid })));
  const rows = [row(menu)];
  if (s.score) rows.push(row(new StringSelectMenuBuilder().setCustomId(`bc_base_${s.id}`).setPlaceholder('計算基準を選択').addOptions(Object.entries(art.BASES).map(([value, b]) => ({ label: b.nm, value, default: value === s.base })))));
  rows.push(row(button(`bc_post_${s.id}`, 'チャンネルに投稿', ButtonStyle.Primary).setDisabled(!s.buf), button(`bc_toggle_${s.id}`, 'スコアあり／なしを切替'), button(`bc_end_${s.id}`, '終了')));
  return rows;
}

async function refresh(i, s) {
  const a = s.list.find(a => String(a.avatarId) === s.aid);
  if (!a || (s.score && !s.base)) {
    s.buf = null;
    return i.editReply({ embeds: [box('キャラクターを選んでね！\nスコア付きの場合は、計算基準も選択できます。\n\n作成後もキャラクターや計算基準を変更して、何度でも作り直せます。')], attachments: [], components: controls(s) });
  }
  const d = await require('./character').build(a, s.uid, s.base, s.score);
  s.buf = await require('./charCard').charCard(d);
  s.caption = `## ${d.name}のビルドカード\n${s.score && !a.lim ? `計算基準：${art.BASES[s.base].nm}` : 'スコアなし'}${a.lim ? '\nキャラ詳細が非公開のため、わかる範囲で作ったよ。' : ''}`;
  s.embed = box(s.caption).setImage('attachment://build-card.png');
  return i.editReply({ embeds: [box(s.caption + '\n\nキャラクターや計算基準を変えて、何度でも作り直せるよ！').setImage('attachment://build-card.png')], attachments: [], files: [new AttachmentBuilder(s.buf, { name: 'build-card.png' })], components: controls(s) });
}

async function handle(i) {
  if (!GI.includes(i.guildId)) return i.reply({ content: 'このサーバーでは使用できません。', ephemeral: true });
  // 放置した画面の画像バッファは解放する。
  for (const [id, s] of sessions) if (Date.now() - s.at > TTL) sessions.delete(id);
  if (i.customId.startsWith('bc_open_')) {
    const uid = st.get(i.guildId).intro?.[i.user.id]?.uid;
    if (!uid) return i.reply({ content: '先に自己紹介からUIDを登録してね！', ephemeral: true });
    await i.deferReply({ ephemeral: true });
    const { p, raw } = await en.player(uid);
    if (!p) return i.editReply('プレイヤー情報を取得できませんでした。UIDを確認して、少し待ってから試してね。');
    const list = raw?.length ? raw : (p.showAvatarInfoList || []).map(a => ({ ...a, lim: true }));
    if (!list.length) return i.editReply('展示しているキャラクターがいなかったよ。');
    for (const [id, old] of sessions) if (old.user === i.user.id && old.channel === i.channelId) sessions.delete(id);
    const s = { id: randomBytes(8).toString('hex'), user: i.user.id, channel: i.channelId, guild: i.guildId, uid, list, names: await en.names(), score: i.customId.endsWith('score'), base: null, aid: null, at: Date.now() };
    sessions.set(s.id, s);
    return await refresh(i, s);
  }
  const [, action, id] = i.customId.split('_');
  const s = sessions.get(id);
  if (!s || s.user !== i.user.id || s.guild !== i.guildId || s.channel !== i.channelId) return i.reply({ content: '操作画面の有効期限が切れたよ。案内のボタンから開き直してね。', ephemeral: true });
  if (s.busy) return i.deferUpdate();
  s.busy = true;
  try {
    await i.deferUpdate();
    s.at = Date.now();
    if (action === 'end') { sessions.delete(id); return i.deleteReply(); }
    if (action === 'post') {
      if (!s.buf) return;
      const m = await i.channel.send({ embeds: [s.embed], files: [new AttachmentBuilder(s.buf, { name: 'build-card.png' })], allowedMentions: { parse: [] } });
      await place(i.channel);
      return i.editReply({ embeds: [box(s.caption + `\n\n[投稿したカードを見る](${m.url})\nキャラクターや計算基準を変えて続けて作成できます。`).setImage('attachment://build-card.png')], components: controls(s) });
    }
    if (action === 'char' && s.list.some(a => String(a.avatarId) === i.values[0])) s.aid = i.values[0];
    if (action === 'base' && art.BASES[i.values[0]]) s.base = i.values[0];
    if (action === 'toggle') s.score = !s.score;
    return await refresh(i, s);
  } finally { s.busy = false; }
}

const cleanup = setInterval(() => { for (const [id, s] of sessions) if (Date.now() - s.at > TTL) sessions.delete(id); }, 60000);
cleanup.unref();
module.exports = { start, handle, place, panel };
