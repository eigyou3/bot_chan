const { test } = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../utils/buildLocale');
const en = require('../utils/enka');
const character = require('../utils/character');

test('Discord locale selects supported build-card languages', () => {
  assert.equal(i18n.language('ja'), 'ja');
  assert.equal(i18n.language('en-US'), 'en');
  assert.equal(i18n.language('zh-CN'), 'zh-CN');
  assert.equal(i18n.language('zh-TW'), 'zh-TW');
  assert.equal(i18n.language('zh-HK'), 'zh-TW');
  assert.equal(i18n.language('fr'), 'ja');
});

test('UI labels and score bases are translated without changing Japanese defaults', () => {
  assert.equal(i18n.t('ja', 'select'), 'キャラクターを選択');
  assert.equal(i18n.t('en-US', 'select'), 'Select a character');
  assert.equal(i18n.t('zh-CN', 'artifacts'), '圣遗物');
  assert.equal(i18n.t('zh-TW', 'artifacts'), '聖遺物');
  assert.equal(i18n.basis('en-US', 'atk'), 'ATK');
});

test('Build card translates stat names without changing stat values', async () => {
  const old = { names:en.names, name:en.name, char:en.char };
  en.names = async () => ({ 1: 'テスト' });
  en.name = (id, lang) => ({ ja:'テスト', en:'Test', 'zh-CN':'测试', 'zh-TW':'測試' })[lang];
  en.char = () => ({ Element:'Water', Skills: {}, SkillOrder:[] });
  const avatar = { avatarId:1, fightPropMap:{2000:10000,2001:1000,2002:500,28:20,20:0.5,22:1,23:1.2},equipList:[] };
  try {
    const ja = await character.build(avatar,'123456789',null,false,'ja');
    const enCard = await character.build(avatar,'123456789',null,false,'en-US');
    const cn = await character.build(avatar,'123456789',null,false,'zh-CN');
    assert.equal(ja.stats[1][0], '攻撃力');
    assert.equal(enCard.stats[1][0], 'ATK');
    assert.equal(cn.stats[1][0], '攻击力');
    assert.equal(ja.stats[1][1], enCard.stats[1][1]);
    assert.equal(enCard.name, 'Test');
    assert.equal(cn.name, '测试');
  } finally { en.names=old.names; en.name=old.name; en.char=old.char; }
});
