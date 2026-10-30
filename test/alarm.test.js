const { test } = require('node:test');
const assert = require('node:assert/strict');
const st = require('../utils/store');
const command = require('../commands/alarm');
const alarm = require('../utils/alarm');

test('alarm records its setter and updates old matching records without duplication', async () => {
  const save = st.save; st.save = async () => true;
  const guild = { id: 'alarm-guild', channels: { cache: { find: () => ({}) } } };
  st.get(guild.id).alarms.push({ ch: 'ch', time: '05:30', msg: '集合してね' });
  let result;
  const i = { guild, channelId: 'ch', member: { displayName: '設定した人' }, user: { id: '1088369918069715024', displayAvatarURL: () => 'https://example.com/avatar.png' }, options: { getString: k => k === 'times' ? '5:30 21:00 29:00' : '集合してね' }, deferReply: async () => {}, editReply: async p => { result = p; }, deleteReply: async () => {} };
  try {
    await command.execute(i);
    const alarms = st.get(guild.id).alarms;
    assert.equal(alarms.length, 2);
    for (const a of alarms) { assert.equal(a.by, i.user.id); assert.equal(a.byName, '設定した人'); }
    assert.match(result.embeds[0].toJSON().description, /設定者：<@1088369918069715024>/);
    const posted = [];
    await alarm.tick({ channels: { fetch: async () => ({ send: async p => posted.push(p) }) } }, '21:00');
    assert.equal(posted.length, 1);
    assert.equal(posted[0].embeds[0].toJSON().description, '集合してね');
    assert.equal(posted[0].embeds[0].toJSON().author.name, '設定した人 さんのアラーム');
    assert.equal(posted[0].content, undefined);
  } finally { st.save = save; st.db.clear(); }
});

test('legacy alarm labels unknown setter and original message mentions still notify', () => {
  const p = alarm.payload({ time: '12:00', msg: '<@&12345> 集合 @here', ch: 'ch' });
  assert.match(p.embeds[0].toJSON().fields[0].value, /未記録/);
  assert.equal(p.content, '<@&12345> @here');
  p.embeds[0].toJSON();
});
