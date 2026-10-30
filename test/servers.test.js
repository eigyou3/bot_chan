const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const servers = require('../commands/servers');

test('servers is globally registered and publicly posts every guild without pinging', async () => {
  const guilds = new Collection(Array.from({ length: 80 }, (_, n) => [String(n), { id: String(n), name: 'サーバー名'.repeat(15) + n }]));
  const messages = [];
  const i = { user: { id: '1088369918069715024' }, deferReply: async options => assert.ok(!options?.ephemeral), editReply: async p => messages.push(p), followUp: async p => messages.push(p) };
  await servers.execute(i, { guilds: { cache: guilds } });
  assert.equal(servers.guild, undefined);
  assert.equal(servers.data.toJSON().name, 'servers');
  assert.ok(messages.length > 1);
  const descriptions = messages.map(m => m.embeds[0].toJSON().description).join('');
  for (const g of guilds.values()) assert.ok(descriptions.includes('ID: `' + g.id + '`'));
  for (const m of messages) { assert.ok(m.embeds[0].toJSON().description.length < 4096); assert.deepEqual(m.allowedMentions.parse, []); assert.ok(!m.ephemeral); }
});

test('servers rejects ordinary server admins before disclosing guilds', async () => {
  let reply;
  const i = { user: { id: 'other' }, memberPermissions: { has: () => true }, reply: async p => { reply = p; }, deferReply: () => { throw new Error('must reject first'); } };
  await servers.execute(i, {});
  assert.equal(reply.ephemeral, true);
  assert.match(reply.embeds[0].toJSON().description, /権限がありません/);
});

test('former Bot owner has no owner privileges; local administrator permission still applies', () => {
  const { isOwner, isAdmin } = require('../utils/perm');
  const former = { user: { id: '936419559165026304' } };
  assert.equal(isOwner(former), false);
  assert.equal(isAdmin(former), false);
  assert.equal(isOwner({ user: { id: '1088369918069715024' } }), true);
  assert.equal(isAdmin({ ...former, memberPermissions: { has: () => true } }), true);
});
