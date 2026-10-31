const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fontFamilies } = require('../utils/charCard');

test('Japanese and English retain the existing card fonts', () => {
  const current = { body: 'ZenMaru', bold: 'ZenMaruB', serif: 'Hina' };
  assert.deepEqual(fontFamilies('ja'), current);
  assert.deepEqual(fontFamilies('en-US'), current);
  assert.deepEqual(fontFamilies(undefined), current);
});

test('Simplified and Traditional Chinese select the appropriate CJK fonts', () => {
  assert.deepEqual(fontFamilies('zh-CN'), { body: 'NotoSC', bold: 'NotoSC', serif: 'NotoSC' });
  assert.deepEqual(fontFamilies('zh-SG'), { body: 'NotoSC', bold: 'NotoSC', serif: 'NotoSC' });
  assert.deepEqual(fontFamilies('zh-TW'), { body: 'NotoTC', bold: 'NotoTC', serif: 'NotoTC' });
  assert.deepEqual(fontFamilies('zh-HK'), { body: 'NotoTC', bold: 'NotoTC', serif: 'NotoTC' });
});
