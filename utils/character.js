const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

const st = require('./store');
const en = require('./enka');
const art = require('./artifact');
const { charCard, EL } = require('./charCard');

const INTRO_CH = '1510962713612914698';
const COLOR = '#8A8A8A';
const box = (t, c = COLOR) => new EmbedBuilder().setColor(c).setDescription(t);
const who = i => `<@${i.user.id}> が \`/character\` を実行`;

// 聖遺物の小さい表記
const SH = {
  FIGHT_PROP_HP: 'HP', FIGHT_PROP_HP_PERCENT: 'HP%', FIGHT_PROP_ATTACK: '攻撃', FIGHT_PROP_ATTACK_PERCENT: '攻撃%',
  FIGHT_PROP_DEFENSE: '防御', FIGHT_PROP_DEFENSE_PERCENT: '防御%', FIGHT_PROP_ELEMENT_MASTERY: '熟知',
  FIGHT_PROP_CRITICAL: '会心', FIGHT_PROP_CRITICAL_HURT: '会ダメ', FIGHT_PROP_CHARGE_EFFICIENCY: '元チャ',
  FIGHT_PROP_HEAL_ADD: '治療', FIGHT_PROP_PHYSICAL_ADD_HURT: '物理', FIGHT_PROP_FIRE_ADD_HURT: '炎ダメ',
  FIGHT_PROP_ELEC_ADD_HURT: '雷ダメ', FIGHT_PROP_WATER_ADD_HURT: '水ダメ', FIGHT_PROP_GRASS_ADD_HURT: '草ダメ',
  FIGHT_PROP_WIND_ADD_HURT: '風ダメ', FIGHT_PROP_ROCK_ADD_HURT: '岩ダメ', FIGHT_PROP_ICE_ADD_HURT: '氷ダメ',
};
const isPct = id => /_PERCENT$|CRITICAL|CHARGE_EFFICIENCY|_ADD_HURT$|HEAL_ADD$/.test(id);
const val = (id, v) => isPct(id) ? (+v).toFixed(1) : String(Math.round(v));

// 元素ダメージのfightPropのキー
const DMG = { Fire: [40, '炎'], Electric: [41, '雷'], Water: [42, '水'], Grass: [43, '草'], Wind: [44, '風'], Rock: [45, '岩'], Ice: [46, '氷'] };

const n0 = v => Math.round(v).toLocaleString('en-US');
const p1 = v => `${(v * 100).toFixed(1)}%`;

// Enkaのデータ → カード用
async function build(a, uid, base, showOp) {
  const nm = await en.names();
  const c = en.char(a.avatarId) || {};
  const fp = a.fightPropMap || {};
  const el = c.Element;

  const side = (c.SideIconName || '').replace('UI_AvatarIcon_Side_', '');
  const cos = a.costumeId && c.Costumes?.[String(a.costumeId)];
  const artUrl = cos?.art ? `${en.UI}${cos.art}.png` : side ? `${en.UI}UI_Gacha_AvatarImg_${side}.png` : null;

  // 天賦（凸で上がった分も足す）
  // キャラ詳細が非公開＝取れるのはキャラ・Lv・衣装だけ
  if (a.lim) {
    return {
      name: nm[String(a.avatarId)] || '？', el, lv: a.level ?? '-',
      cons: a.talentLevel ?? null, tal: ['-', '-', '-'], art: artUrl,
      stats: ['HP', '攻撃力', '防御力', '元素熟知', '会心率', '会心ダメージ', '元素チャージ効率', '元素ダメージ'].map(k => [k, '-']),
      wp: { name: '-', lv: '-', r: null, sub: '' },
      sets: [['-', 0]], relics: art.ORDER.map(() => ({ icon: null })),
      total: 0, base: '', showOp: false, uid,
    };
  }

  const tal = (c.SkillOrder || []).map(id => (a.skillLevelMap?.[id] || 0) + (a.proudSkillExtraLevelMap?.[c.ProudMap?.[id]] || 0));

  // 元素ダメと物理の高い方
  const [dk, dn] = DMG[el] || [30, '物理'];
  const ed = fp[dk] || 0, ph = fp[30] || 0;
  const dmg = ph > ed ? ['物理ダメージ', ph] : [`${dn}元素ダメージ`, ed];

  const stats = [
    ['HP', n0(fp[2000] || 0)],
    ['攻撃力', n0(fp[2001] || 0)],
    ['防御力', n0(fp[2002] || 0)],
    ['元素熟知', n0(fp[28] || 0)],
    ['会心率', p1(fp[20] || 0), 1],
    ['会心ダメージ', p1(fp[22] || 0), 1],
    ['元素チャージ効率', p1(fp[23] || 0)],
    [dmg[0], p1(dmg[1])],
  ];

  const we = (a.equipList || []).find(e => e.weapon);
  const ws = we?.flat?.weaponStats?.[1];
  const wp = we ? {
    name: en.loc(we.flat.nameTextMapHash),
    icon: we.flat.icon ? `${en.UI}${we.flat.icon}.png` : null,
    lv: we.weapon.level,
    r: (Object.values(we.weapon.affixMap || {})[0] ?? 0) + 1,
    sub: ws ? `${en.loc(ws.appendPropId)} ${val(ws.appendPropId, ws.statValue)}${isPct(ws.appendPropId) ? '%' : ''}` : '',
  } : { name: '-', lv: '-', r: 1, sub: '' };

  const rs = art.relics(a);
  const cnt = {};
  rs.forEach(e => { const k = en.loc(e.flat.setNameTextMapHash); cnt[k] = (cnt[k] || 0) + 1; });
  const sets = Object.entries(cnt).filter(([, v]) => v >= 2).sort((x, y) => y[1] - x[1]);

  // 部位ごと（無い部位は空）
  const relics = art.ORDER.map(t => {
    const e = rs.find(x => x.flat.equipType === t);
    if (!e) return { icon: null };
    const m = e.flat.reliquaryMainstat;
    return {
      icon: e.flat.icon ? `${en.UI}${e.flat.icon}.png` : null,
      main: `${SH[m.mainPropId] || ''} ${val(m.mainPropId, m.statValue)}`,
      subs: (e.flat.reliquarySubstats || []).map(x => `${SH[x.appendPropId] || ''} ${val(x.appendPropId, x.statValue)}`),
      score: art.score(e, base || 'atk'),
    };
  });
  const sc = relics.filter(r => r.main).map(r => r.score);
  const top = Math.max(...sc);
  relics.forEach(r => { if (r.main && r.score === top) r.best = true; });

  return {
    name: nm[String(a.avatarId)] || '？', el,
    lv: a.propMap?.['4001']?.val || '-',
    cons: (a.talentIdList || []).length,
    tal, art: artUrl, stats, wp,
    sets: sets.length ? sets : [['-', 0]],
    relics,
    total: sc.reduce((x, y) => x + y, 0),
    base: base ? art.BASES[base].nm : '',
    showOp, uid,
  };
}

// 詳細が見られない人は展示キャラだけで
const list = (p, raw) => raw?.length ? raw : (p?.showAvatarInfoList || []).map(x => ({ ...x, lim: true }));

// 本人だけのメニュー
function charMenu(uid, raw, nm, t) {
  const opts = raw.slice(0, 25).map(a => ({ label: nm[String(a.avatarId)] || `キャラ ${a.avatarId}`, value: String(a.avatarId) }));
  const menu = new StringSelectMenuBuilder().setCustomId(`chr_c_${uid}`).setPlaceholder('キャラを選ぶ').addOptions(opts);
  const end = new ButtonBuilder().setCustomId('chr_end').setLabel('終わる').setStyle(ButtonStyle.Secondary);
  return { embeds: [box(t)], components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(end)] };
}

async function pub(i, t) {
  await i.followUp({ embeds: [box(`${who(i)}\n\n${t}`)] }).catch(() => null);
  return i.deleteReply().catch(() => null);
}

// /character
async function start(i) {
  const uid = st.get(i.guildId).intro?.[i.user.id]?.uid;
  if (!uid) return i.reply({ embeds: [box(`${who(i)}\n\nUIDが登録されてないよ！\n先に <#${INTRO_CH}> で自己紹介をしてね！`)] });

  await i.deferReply({ ephemeral: true });
  const { p, raw, err } = await en.player(uid);
  if (!p) return pub(i, err === 404 ? '登録されてるUIDのプレイヤーが見つからなかったよ。自己紹介からUIDを登録し直してね。' : '今うまく取れなかったよ。少し待ってからもう一度お願いします。');
  const ls = list(p, raw);
  if (!ls.length) return pub(i, '展示してるキャラがいなかったよ。');

  const nm = await en.names();
  return i.editReply(charMenu(uid, ls, nm, 'どのキャラを出す？'));
}

// キャラ → OPを出すか（詳細が見られない人はそのまま投稿）
async function pickChar(i) {
  const uid = i.customId.split('_')[2];
  const aid = i.values[0];
  const { raw } = await en.player(uid);
  if (!raw?.length) return post(i, uid, aid, null, false);
  const menu = new StringSelectMenuBuilder().setCustomId(`chr_o_${uid}_${aid}`).setPlaceholder('聖遺物のOPを出す？').addOptions(
    { label: 'OPとスコアを出す', value: '1' },
    { label: '聖遺物の画像だけ', value: '0' },
  );
  return i.update({ embeds: [box('聖遺物のOPとスコアを出す？')], components: [new ActionRowBuilder().addComponents(menu)] });
}

// OP → 出すなら計算基準、出さないならそのまま投稿
function pickOp(i) {
  const [, , uid, aid] = i.customId.split('_');
  if (i.values[0] === '0') return post(i, uid, aid, null, false);
  const opts = Object.entries(art.BASES).map(([k, b]) => ({ label: b.nm, value: k }));
  const menu = new StringSelectMenuBuilder().setCustomId(`chr_b_${uid}_${aid}`).setPlaceholder('計算基準を選ぶ').addOptions(opts);
  return i.update({ embeds: [box('計算基準は？')], components: [new ActionRowBuilder().addComponents(menu)] });
}

function pickBase(i) {
  const [, , uid, aid] = i.customId.split('_');
  return post(i, uid, aid, i.values[0], true);
}

// 画像を作って投稿 → キャラ選択に戻す
async function post(i, uid, aid, base, showOp) {
  await i.update({ embeds: [box('作ってるよ…')], components: [] });
  const { p, raw } = await en.player(uid);
  const ls = list(p, raw);
  const a = ls.find(x => String(x.avatarId) === aid);
  if (!a) return i.editReply({ embeds: [box('データが取れなかったよ。もう一度 /character からお願いします。')], components: [] });

  const d = await build(a, uid, base, showOp);
  const buf = await charCard(d);
  const ac = (EL[d.el] || [COLOR])[0];
  const note = a.lim ? '\nキャラ詳細が非公開のため、わかる範囲で作ったよ' : '';
  const e = new EmbedBuilder().setColor(ac).setDescription(who(i) + note).setImage('attachment://character.png');
  await i.channel.send({ embeds: [e], files: [new AttachmentBuilder(buf, { name: 'character.png' })] });

  const nm = await en.names();
  return i.editReply(charMenu(uid, ls, nm, '続けて出すならキャラを選んでね'));
}

function end(i) {
  return i.update({ embeds: [box('おつかれさま！')], components: [] }).then(() => i.deleteReply().catch(() => null));
}

module.exports = { start, pickChar, pickOp, pickBase, end, build };
