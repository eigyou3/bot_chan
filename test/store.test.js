const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, PermissionFlagsBits: P } = require('discord.js');
const st = require('../utils/store');

test('config saves visibly with timestamp and updates the same message rather than adding posts', async () => {
  const sent = [], edits = [];
  const old = { id: 'config-message', edit: async p => { edits.push(p); return old; } };
  const ch = { name: 'bot-config', isTextBased: () => true, permissionsFor: () => ({ has: () => true }), messages: { fetch: async () => old }, send: async p => { sent.push(p); return old; } };
  const g = { id: 'store-test', name: '保存テスト', members: { me: {} }, channels: { cache: new Collection([['ch', ch]]) } };
  try {
    st.get(g.id).bump = { here: true, ch: 'bump' };
    assert.equal(await st.save(g), true);
    st.get(g.id).bump.here = false;
    assert.equal(await st.save(g), true);
    assert.equal(sent.length, 1); assert.equal(edits.length, 1);
    assert.match(edits[0].content, /最終保存：<t:/);
    assert.equal(JSON.parse(edits[0].files[0].attachment.toString()).bump.here, false);
    assert.equal(st.warn(g), '');
    ch.permissionsFor = () => ({ has: f => f !== P.AttachFiles });
    assert.equal(await st.save(g), false);
    assert.match(st.warn(g), /ファイルを添付/);
    ch.permissionsFor = () => ({ has: () => true });
    assert.equal(await st.save(g), true); assert.equal(st.warn(g), '');
  } finally { st.db.clear(); }
});
