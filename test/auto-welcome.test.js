const { test } = require('node:test');
const assert = require('node:assert/strict');
const { welcomeEmbed } = require('../utils/autoWelcome');

test('installation welcome explains notification and how to contact creator', () => {
  const data = welcomeEmbed().toJSON();
  assert.match(data.description, /導入ありがとうございます|導入いただき/);
  assert.match(data.description, /制作者に通知されます/);
  assert.match(data.description, /招待してください/);
  assert.match(data.description, /1088369918069715024/);
  assert.match(data.description, /新しい招待リンクを自動作成することはありません/);
});

test('guildCreate sets up private config and still sends existing join notification', async () => {
  const fs = require('fs');
  const script = fs.readFileSync(require.resolve('../events/guildCreate'), 'utf8');
  assert.match(script, /welcomeGuild\(guild\)/);
  assert.match(script, /notifyJoin\(guild\)/);
  assert.match(script, /\.catch\(/);
});
