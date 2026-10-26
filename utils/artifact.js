const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const st = require('./store');
const en = require('./enka');

// スコア計算（relicerの式）  s = サブOPの合計
const BASES = {
  atk:   { nm: '攻撃',         f: s => s.ATK_P + s.ATK / 9 + s.CR * 2 + s.CD },
  hp:    { nm: 'HP',           f: s => s.HP_P + s.HP / 138.25 + s.CR * 2 + s.CD },
  def:   { nm: '防御',         f: s => s.DEF_P * 0.8 + s.DEF / 10.7 + s.CR * 2 + s.CD },
  em:    { nm: '熟知',         f: s => s.CR * 2 + s.CD + s.EM * 0.335 },
  hpo:   { nm: 'HPのみ',       f: s => s.HP_P * 1.68 + s.HP / 82.29 },
  atko:  { nm: '攻撃のみ',     f: s => s.ATK_P * 1.68 + s.ATK / 5.357 },
  defo:  { nm: '防御のみ',     f: s => s.DEF_P * 1.344 + s.DEF / 6.37 },
  hper:  { nm: 'HP+チャージ',   f: s => (s.HP_P + s.HP / 138.25 + s.ER * 0.9) * 1.453 },
  atker: { nm: '攻撃+チャージ', f: s => (s.ATK_P + s.ATK / 9 + s.ER * 0.9) * 1.453 },
  defer: { nm: '防御+チャージ', f: s => (s.DEF_P * 0.8 + s.DEF / 10.7 + s.ER * 0.9) * 1.453 },
};

const KEY = {
  FIGHT_PROP_HP: 'HP', FIGHT_PROP_HP_PERCENT: 'HP_P',
  FIGHT_PROP_ATTACK: 'ATK', FIGHT_PROP_ATTACK_PERCENT: 'ATK_P',
  FIGHT_PROP_DEFENSE: 'DEF', FIGHT_PROP_DEFENSE_PERCENT: 'DEF_P',
  FIGHT_PROP_CRITICAL: 'CR', FIGHT_PROP_CRITICAL_HURT: 'CD',
  FIGHT_PROP_CHARGE_EFFICIENCY: 'ER', FIGHT_PROP_ELEMENT_MASTERY: 'EM',
};

const PARTS = { EQUIP_BRACER: '花', EQUIP_NECKLACE: '羽', EQUIP_SHOES: '時計', EQUIP_RING: '杯', EQUIP_DRESS: '冠' };
const ORDER = Object.keys(PARTS);

// %表示のステータス
const isPct = id => /_PERCENT$|CRITICAL|CHARGE_EFFICIENCY|_ADD_HURT$|HEAL_ADD$/.test(id);
const stat = (id, v) => `${en.loc(id) || id} ${isPct(id) ? `${(+v).toFixed(1)}%` : Math.round(v)}`;

function score(eq, base) {
  const s = { HP: 0, HP_P: 0, ATK: 0, ATK_P: 0, DEF: 0, DEF_P: 0, CR: 0, CD: 0, ER: 0, EM: 0 };
  for (const x of eq.flat.reliquarySubstats || []) {
    const k = KEY[x.appendPropId];
    if (k) s[k] += x.statValue;
  }
  return +BASES[base].f(s).toFixed(1);
}

// 冠だけ10下げ
function rank(v, part) {
  const d = part === 'EQUIP_DRESS' ? 10 : 0;
  if (v >= 50 - d) return { t: '家宝', c: '#BA7517' };
  if (v >= 40 - d) return { t: '良', c: '#378ADD' };
  return { t: '', c: '#5F5E5A' };
}

const relics = a => (a.equipList || []).filter(e => e.reliquary && PARTS[e.flat?.equipType])
  .sort((x, y) => ORDER.indexOf(x.flat.equipType) - ORDER.indexOf(y.flat.equipType));

const COLOR = '#BA7517';
// 誰が実行したか先頭に出す
const who = i => `<@${i.user.id}> が \`/artifact\` を実行`;
const box = t => new EmbedBuilder().setColor(COLOR).setDescription(t);
// 本人だけのメニュー（中身もEmbed）
const ask = (t, menu) => ({ embeds: [box(t)], components: [new ActionRowBuilder().addComponents(menu)] });
// みんなに見える返事
async function pub(i, t) {
  await i.followUp({ embeds: [box(t)] }).catch(() => null);
  return i.deleteReply().catch(() => null);
}

// /artifact → キャラ選択
async function start(i) {
  const uid = st.get(i.guildId).intro?.[i.user.id]?.uid;
  // 他人の聖遺物は出さない＝登録済みのUIDだけ
  if (!uid) {
    const ic = st.get(i.guildId).introP?.ch;
    return i.reply({ embeds: [box(`${who(i)}\n\nUIDが登録されてないよ！\n先に${ic ? ` <#${ic}> で` : ''}UID登録をしてね！`)] });
  }

  await i.deferReply({ ephemeral: true });
  const { p, raw, err } = await en.player(uid);
  if (!p) return pub(i, who(i) + '\n\n' + (err === 404 ? '登録されてるUIDのプレイヤーが見つからなかったよ。自己紹介からUIDを登録し直してね。' : '今うまく取れなかったよ。少し待ってからもう一度お願いします。'));
  if (!raw?.length) return pub(i, `${who(i)}\n\nキャラの詳細が見られなかったよ。\nゲームのプロフィールで「キャラ詳細を表示」をオンにしてね。`);

  const nm = await en.names();
  const opts = raw.filter(a => relics(a).length).slice(0, 25).map(a => ({ label: nm[String(a.avatarId)] || `キャラ ${a.avatarId}`, value: String(a.avatarId) }));
  if (!opts.length) return pub(i, `${who(i)}\n\n聖遺物を付けてる展示キャラがいなかったよ。`);

  const menu = new StringSelectMenuBuilder().setCustomId(`art_c_${uid}`).setPlaceholder('キャラを選ぶ').addOptions(opts);
  return i.editReply(ask('どのキャラの聖遺物を自慢する？', menu));
}

// キャラ選択 → 計算基準
async function pickChar(i) {
  const uid = i.customId.split('_')[2];
  const aid = i.values[0];
  const opts = Object.entries(BASES).map(([k, b]) => ({ label: b.nm, value: k }));
  const menu = new StringSelectMenuBuilder().setCustomId(`art_b_${uid}_${aid}`).setPlaceholder('計算基準を選ぶ').addOptions(opts);
  return i.update(ask('計算基準は？', menu));
}

// 計算基準 → 部位選択
async function pickBase(i) {
  const [, , uid, aid] = i.customId.split('_');
  const base = i.values[0];
  const { raw } = await en.player(uid);
  const a = raw?.find(x => String(x.avatarId) === aid);
  if (!a) return i.update({ embeds: [box('データが取れなかったよ。もう一度 /artifact からお願いします。')], components: [] });

  const opts = relics(a).map(e => {
    const m = e.flat.reliquaryMainstat;
    return { label: `${PARTS[e.flat.equipType]}　${stat(m.mainPropId, m.statValue)}`, description: `スコア ${score(e, base).toFixed(1)}`, value: e.flat.equipType };
  });
  const menu = new StringSelectMenuBuilder().setCustomId(`art_p_${uid}_${aid}_${base}`).setPlaceholder('部位を選ぶ').addOptions(opts);
  return i.update(ask(`どの部位を自慢する？（${BASES[base].nm}基準）`, menu));
}

// 部位選択 → カード投稿
async function pickPart(i) {
  const [, , uid, aid, base] = i.customId.split('_');
  await i.deferUpdate();
  const { p, raw } = await en.player(uid);
  const a = raw?.find(x => String(x.avatarId) === aid);
  const e = a && relics(a).find(x => x.flat.equipType === i.values[0]);
  if (!e) return i.editReply({ embeds: [box('データが取れなかったよ。もう一度 /artifact からお願いします。')], components: [] });

  const nm = await en.names();
  const f = e.flat;
  const v = score(e, base);
  const r = rank(v, f.equipType);
  const m = f.reliquaryMainstat;
  const subs = (f.reliquarySubstats || []).map(x => `・${stat(x.appendPropId, x.statValue)}`).join('\n');

  const emb = new EmbedBuilder()
    .setColor(r.c)
    .setAuthor({ name: `${i.member.displayName} さんの自慢の聖遺物`, iconURL: en.pfpIcon(p?.profilePicture) || i.user.displayAvatarURL() })
    .setDescription(`${who(i)}\n## スコア ${v.toFixed(1)}${r.t ? `　${r.t}` : ''}\n${BASES[base].nm}基準`)
    .addFields({
      name: `${nm[aid] || ''} ／ ${en.loc(f.setNameTextMapHash)} ／ ${PARTS[f.equipType]} ＋${(e.reliquary.level || 1) - 1}`,
      value: `**${stat(m.mainPropId, m.statValue)}**\n${subs}`,
    })
    .setFooter({ text: `UID ${uid}` });
  if (f.icon) emb.setThumbnail(`${en.UI}${f.icon}.png`);

  await i.channel.send({ embeds: [emb] });
  return i.deleteReply().catch(() => null);
}

module.exports = { BASES, PARTS, ORDER, start, pickChar, pickBase, pickPart, score, rank, relics };
