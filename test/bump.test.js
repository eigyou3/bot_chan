const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const st = require('../utils/store');
const bump = require('../utils/bump');
const command = require('../commands/setbump');

test('sticky reposts at bottom without repeating here or resetting cooldown, even when reminder races', async () => {
  const save = st.save, later = st.saveLater; st.save = async () => true; st.saveLater = () => {};
  const sends = [], deletes = [];
  const g = { id: 'sticky-test', channels: { cache: new Collection() } };
  const ch = { id: 'ch', guildId: g.id, guild: g, messages: { fetch: async id => ({ delete: async () => deletes.push(id), edit: async () => ({}) }) }, send: async p => { sends.push(p); return { id: 'post-' + sends.length }; } };
  g.channels.cache.set(ch.id, ch);
  const client = { guilds: { cache: new Collection([[g.id, g]]) } };
  const at = Date.now() - 7201000;
  st.get(g.id).bump = { ch: ch.id, msg: 'old', at, rem: false, here: true, by: '12345' };
  try {
    await Promise.all([bump.place(ch), bump.tick(client), bump.place(ch)]);
    await bump.tick(client);
    const b = st.get(g.id).bump;
    assert.equal(sends.length, 3); assert.equal(deletes.length, 3);
    assert.equal(sends.filter(p => p.content === '@here').length, 1);
    for (const p of sends.filter(p => p.content !== '@here')) {
      assert.deepEqual(p.allowedMentions.parse, []); assert.ok(p.flags);
    }
    assert.equal(b.at, at); assert.equal(b.rem, true); assert.equal(b.here, true); assert.equal(b.msg, 'post-3');
    b.at = Date.now(); b.rem = false;
    await bump.place(ch);
    assert.match(sends.at(-1).embeds[0].toJSON().description, /<@12345>/);
    assert.match(sends.at(-1).embeds[0].toJSON().description, /次にbump/);
  } finally { st.save = save; st.saveLater = later; st.db.clear(); }
});

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
