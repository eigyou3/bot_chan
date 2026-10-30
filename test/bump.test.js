const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const st = require('../utils/store');
const bump = require('../utils/bump');
const command = require('../commands/setbump');

test('setbump is global, saves here flag, and preserves timer when history is absent', async () => {
  assert.equal(command.guild, undefined); assert.equal(command.genshin, undefined);
  assert.equal(command.data.toJSON().options[0].name, 'here');
  const save = st.save; st.save = async () => true;
  const g = { id: '1538858318091522149', members: { me: {} }, channels: { cache: { find: () => ({}) } } };
  const at = Date.now();
  st.get(g.id).bump = { ch: 'ch', at, rem: false };
  let here = true, result;
  const i = { guildId: g.id, guild: g, channelId: 'ch', user: { id: '1088369918069715024' }, options: { getBoolean: () => here }, deferReply: async () => {}, editReply: async p => { result = p; }, deleteReply: async () => {}, channel: { permissionsFor: () => ({ has: () => true }), messages: { fetch: async arg => typeof arg === 'string' ? { edit: async () => ({}), delete: async () => {} } : new Collection() }, send: async () => ({ id: 'msg' }) } };
  try {
    await bump.set(i); assert.equal(st.get(g.id).bump.here, true); assert.equal(st.get(g.id).bump.at, at);
    here = false;
    await bump.set(i); assert.equal(st.get(g.id).bump.here, false);
    assert.match(result.embeds[0].toJSON().description, /OFF/);
  } finally { st.save = save; st.db.clear(); }
});

test('@here ON sends one new notification, OFF quietly edits, and concurrent ticks do not double ping', async () => {
  const save = st.save; st.save = async () => true;
  const sends = [], edits = [], deleted = [];
  const old = { edit: async p => { edits.push(p); return old; }, delete: async () => deleted.push(true) };
  const ch = { messages: { fetch: async () => old }, send: async p => { sends.push(p); return { id: 'new' }; } };
  const g = { id: 'here-test', channels: { cache: new Collection([['ch', ch]]) } };
  const client = { guilds: { cache: new Collection([[g.id, g]]) } };
  st.get(g.id).bump = { ch: 'ch', msg: 'old', at: Date.now() - 7201000, rem: false, here: true };
  try {
    await Promise.all([bump.tick(client), bump.tick(client)]);
    assert.equal(sends.length, 1); assert.equal(edits.length, 0); assert.equal(deleted.length, 1);
    assert.equal(sends[0].content, '@here'); assert.deepEqual(sends[0].allowedMentions.parse, ['everyone']); assert.equal(sends[0].flags, undefined);
    st.get(g.id).bump.here = false; st.get(g.id).bump.rem = false;
    await bump.tick(client);
    assert.equal(sends.length, 1); assert.equal(edits.length, 1); assert.deepEqual(edits[0].allowedMentions.parse, []);
  } finally { st.save = save; st.db.clear(); }
});
