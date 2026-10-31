const en = require('./enka');
const art = require('./artifact');
const i18n = require('./buildLocale');

// 聖遺物の小さい表記
const SH = {
  FIGHT_PROP_HP: 'HP', FIGHT_PROP_HP_PERCENT: 'HP%', FIGHT_PROP_ATTACK: '攻撃', FIGHT_PROP_ATTACK_PERCENT: '攻撃%',
  FIGHT_PROP_DEFENSE: '防御', FIGHT_PROP_DEFENSE_PERCENT: '防御%', FIGHT_PROP_ELEMENT_MASTERY: '熟知',
  FIGHT_PROP_CRITICAL: '会心', FIGHT_PROP_CRITICAL_HURT: '会ダメ', FIGHT_PROP_CHARGE_EFFICIENCY: '元チャ',
  FIGHT_PROP_HEAL_ADD: '治療', FIGHT_PROP_PHYSICAL_ADD_HURT: '物理', FIGHT_PROP_FIRE_ADD_HURT: '炎ダメ',
  FIGHT_PROP_ELEC_ADD_HURT: '雷ダメ', FIGHT_PROP_WATER_ADD_HURT: '水ダメ', FIGHT_PROP_GRASS_ADD_HURT: '草ダメ',
  FIGHT_PROP_WIND_ADD_HURT: '風ダメ', FIGHT_PROP_ROCK_ADD_HURT: '岩ダメ', FIGHT_PROP_ICE_ADD_HURT: '氷ダメ',
};
const shortKeys = { FIGHT_PROP_HP:'hp',FIGHT_PROP_HP_PERCENT:'hp',FIGHT_PROP_ATTACK:'atkShort',FIGHT_PROP_ATTACK_PERCENT:'atkShort',FIGHT_PROP_DEFENSE:'defShort',FIGHT_PROP_DEFENSE_PERCENT:'defShort',FIGHT_PROP_ELEMENT_MASTERY:'emShort',FIGHT_PROP_CRITICAL:'cr',FIGHT_PROP_CRITICAL_HURT:'cdShort',FIGHT_PROP_CHARGE_EFFICIENCY:'erShort',FIGHT_PROP_HEAL_ADD:'heal',FIGHT_PROP_PHYSICAL_ADD_HURT:'physicalShort' };
const localShort = (id,lang) => { if(lang==='ja') return SH[id] || ''; const k=shortKeys[id]; return k ? i18n.t(lang,k) : /_ADD_HURT$/.test(id) ? i18n.t(lang,'dmgShort') : SH[id] || ''; };
const isPct = id => /_PERCENT$|CRITICAL|CHARGE_EFFICIENCY|_ADD_HURT$|HEAL_ADD$/.test(id);
const val = (id, v) => isPct(id) ? (+v).toFixed(1) : String(Math.round(v));

// 元素ダメージのfightPropのキー
const DMG = { Fire: [40, '炎'], Electric: [41, '雷'], Water: [42, '水'], Grass: [43, '草'], Wind: [44, '風'], Rock: [45, '岩'], Ice: [46, '氷'] };

const n0 = v => Math.round(v).toLocaleString('en-US');
const p1 = v => `${(v * 100).toFixed(1)}%`;

// Enkaのデータ → カード用
async function build(a, uid, base, showOp, locale = 'ja') {
  const lang = i18n.language(locale);
  const tr = key => i18n.t(lang,key);
  const nm = await en.names();
  const c = en.char(a.avatarId) || {};
  const fp = a.fightPropMap || {};
  const el = c.Element;

  const side = (c.SideIconName || '').replace('UI_AvatarIcon_Side_', '');
  const cos = a.costumeId && c.Costumes?.[String(a.costumeId)];
  const doll = en.doll(a.avatarId);
  const artUrl = cos?.art ? en.uiPath(cos.art) : side ? en.uiPath(`UI_Gacha_AvatarImg_${side}`) : null;
  // The dressable Mannequin has no guaranteed static splash art.
  const artFallback = doll ? en.charIcon(a) : null;
  // 新形式は /ui/xxx.png、旧形式は xxx。天賦Lvと同じSkillOrderで並べる。
  const talIcons = (c.SkillOrder || []).slice(0, 3).map(id => {
    const icon = c.Skills?.[id];
    return icon ? `${en.UI}${icon.replace(/^\/ui\//, '').replace(/\.png$/, '')}.png` : null;
  });

  // 天賦（凸で上がった分も足す）
  // キャラ詳細が非公開＝取れるのはキャラ・Lv・衣装だけ
  if (a.lim) {
    return {
      name: en.name(a.avatarId, lang) || nm[String(a.avatarId)] || '？', el, lv: a.level ?? '-',
      cons: a.talentLevel ?? null, tal: ['-', '-', '-'], talIcons, art: artUrl, artFallback,
      stats: ['hp','atk','def','em','cr','cd','er','dmg'].map(k => [tr(k), '-']),
      wp: { name: '-', lv: '-', r: null, sub: '' },
      sets: [['-', 0]], relics: art.ORDER.map(() => ({ icon: null })),
      total: 0, base: '', showOp: false, uid, locale: lang,
    };
  }

  const tal = (c.SkillOrder || []).map(id => (a.skillLevelMap?.[id] || 0) + (a.proudSkillExtraLevelMap?.[c.ProudMap?.[id]] || 0));

  // 元素ダメと物理の高い方
  const [dk, dn] = DMG[el] || [30, '物理'];
  const ed = fp[dk] || 0, ph = fp[30] || 0;
  const dmg = ph > ed ? [tr('physical'), ph] : [lang === 'ja' ? `${dn}元素ダメージ` : `${i18n.element(lang,el)} ${tr('elemental')}`, ed];

  const stats = [
    ['HP', n0(fp[2000] || 0)],
    [''+tr('atk')+'', n0(fp[2001] || 0)],
    [''+tr('def')+'', n0(fp[2002] || 0)],
    [''+tr('em')+'', n0(fp[28] || 0)],
    [''+tr('cr')+'', p1(fp[20] || 0), 1],
    [''+tr('cd')+'', p1(fp[22] || 0), 1],
    [''+tr('er')+'', p1(fp[23] || 0)],
    [dmg[0], p1(dmg[1])],
  ];
  if (showOp) for (const entry of stats) if (art.HIGHLIGHTS[base]?.includes(entry[0])) entry[2] = 1;

  const we = (a.equipList || []).find(e => e.weapon);
  const ws = we?.flat?.weaponStats?.[1];
  const wp = we ? {
    name: en.loc(we.flat.nameTextMapHash, lang),
    icon: we.flat.icon ? `${en.UI}${we.flat.icon}.png` : null,
    lv: we.weapon.level,
    r: (Object.values(we.weapon.affixMap || {})[0] ?? 0) + 1,
    sub: ws ? `${en.loc(ws.appendPropId, lang)} ${val(ws.appendPropId, ws.statValue)}${isPct(ws.appendPropId) ? '%' : ''}` : '',
  } : { name: '-', lv: '-', r: 1, sub: '' };

  const rs = art.relics(a);
  const cnt = new Map();
  rs.forEach(e => {
    const set = en.relicSet(e, lang);
    const entry = cnt.get(set.id) || { name: set.name, count: 0 };
    entry.count++;
    cnt.set(set.id, entry);
  });
  const sets = [...cnt.values()].filter(s => s.count >= 2).sort((a, b) => b.count - a.count).map(s => [s.name, s.count]);

  // 部位ごと（無い部位は空）
  const relics = art.ORDER.map(t => {
    const e = rs.find(x => x.flat.equipType === t);
    if (!e) return { icon: null };
    const m = e.flat.reliquaryMainstat;
    return {
      icon: e.flat.icon ? `${en.UI}${e.flat.icon}.png` : null,
      main: `${localShort(m.mainPropId, lang) || ''} ${val(m.mainPropId, m.statValue)}`,
      subs: (e.flat.reliquarySubstats || []).map(x => `${localShort(x.appendPropId, lang) || ''} ${val(x.appendPropId, x.statValue)}`),
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
    tal, talIcons, art: artUrl, artFallback, stats, wp,
    sets: sets.length ? sets : [['-', 0]],
    relics,
    total: sc.reduce((x, y) => x + y, 0),
    base: base ? i18n.basis(lang,base) : '',
    showOp, showScore: showOp, uid, locale: lang,
  };
}

module.exports = { build };
