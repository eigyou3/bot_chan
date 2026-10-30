const { test } = require('node:test');
const assert = require('node:assert/strict');
const en = require('../utils/enka');
const character = require('../utils/character');

test('Mannequin male/female share stable Enka icon URLs', () => {
  assert.equal(en.doll(10000117), 'MannequinBoy');
  assert.equal(en.doll(10000118), 'MannequinGirl');
  assert.equal(en.doll('10000117-11702'), 'MannequinBoy');
  assert.equal(en.charIcon({ avatarId: 10000117 }), 'https://enka.network/ui/UI_AvatarIcon_MannequinBoy.png');
  assert.equal(en.charIcon({ avatarId: 10000118 }), 'https://enka.network/ui/UI_AvatarIcon_MannequinGirl.png');
  assert.equal(en.uiPath('/ui/example.png'), 'https://enka.network/ui/example.png');
  assert.equal(en.uiPath('None'), null);
});

test('Doll card generates an image fallback for both public and limited builds', async () => {
  const oldNames = en.names;
  const oldChar = en.char;
  en.names = async () => ({ 10000117: 'ドール', 10000118: 'ドール' });
  en.char = id => ({ Element: 'Fire', SideIconName: id === 10000117 ? 'UI_AvatarIcon_Side_MannequinBoy' : 'UI_AvatarIcon_Side_MannequinGirl', SkillOrder: [], Skills: {} });
  try {
    for (const id of [10000117, 10000118]) {
      const expected = id === 10000117 ? 'MannequinBoy' : 'MannequinGirl';
      for (const lim of [true, false]) {
        const result = await character.build({ avatarId: id, level: 90, lim, fightPropMap: {}, equipList: [] }, '123456789', 'atk', false);
        assert.match(result.artFallback, new RegExp(expected));
        assert.match(result.art, new RegExp(expected));
      }
    }
  } finally {
    en.names = oldNames;
    en.char = oldChar;
  }
});
