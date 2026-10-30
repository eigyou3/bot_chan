const en = require('./enka');
const art = require('./artifact');

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
    showOp, showScore: showOp, uid,
  };
}

module.exports = { build };
