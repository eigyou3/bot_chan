const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Collection, ChannelType, PermissionFlagsBits: P } = require('discord.js');
const st = require('../utils/store');
const { isGI, GI } = require('../utils/gi');
const { guildCommands, syncAll } = require('../utils/registerCommands');
const { ensureConfig } = require('../utils/setup');
const setgenshin = require('../commands/setgenshin');
const help = require('../commands/help');

const commands = new Collection(fs.readdirSync(path.join(__dirname, '../commands')).filter(p => p.endsWith('.js')).map(p => {
  const c = require('../commands/' + p); return [c.data.name, c];
}));

function fixture(id = 'new-guild') {
  const calls = [];
  const ch = { id: 'config', name: 'bot-config', isTextBased: () => true, permissionsFor: () => ({ has: () => true }) };
  const guild = { id, roles: { everyone: { id } }, members: { me: { id: 'bot', permissions: { has: () => true } } }, channels: { cache: new Collection([[ch.id, ch]]), create: async p => { calls.push(p); guild.channels.cache.set(ch.id, ch); return ch; } } };
  const client = { user: { id: 'bot' }, commands, guilds: { cache: new Collection([[id, guild]]) }, rest: { put: async (url, p) => { calls.push({ url, ...p }); } } };
  const i = { guildId: id, guild, user: { id: '1088369918069715024' }, deferReply: async p => assert.ok(!p?.ephemeral), editReply: async p => { i.result = p; } };
  return { guild, client, i, calls };
}

test('register enables all five Genshin commands immediately and posts guide; repeat is safe', async () => {
  const original = st.save; st.save = async () => true;
  const { guild, client, i, calls } = fixture();
  try {
    assert.equal(isGI(guild.id), false);
    await setgenshin.execute(i, client);
    assert.equal(isGI(guild.id), true);
    assert.deepEqual(calls[0].body.map(c => c.name).sort(), ['artifact', 'build-card', 'giftcord', 'intro', 'setgenshinnews']);
    assert.ok(i.result.embeds[0].toJSON().description.includes('/intro'));
    await setgenshin.execute(i, client);
    assert.equal(calls.length, 2); assert.equal(calls[1].body.length, 5);
    const persisted = JSON.parse(JSON.stringify(st.get(guild.id)));
    st.db.clear(); st.db.set(guild.id, persisted);
    assert.equal(isGI(guild.id), true);
    assert.equal(isGI(GI[0]), true);
    const entry = require('../commands/entry');
    st.get(entry.guild).genshin = true;
    assert.ok(guildCommands(client, entry.guild).some(c => c.name === 'entry'));
  } finally { st.save = original; st.db.clear(); }
});

test('setup creates private config, reuses it, and fails clearly when permission is missing', async () => {
  const original = st.save; st.save = async () => true;
  const { guild, calls } = fixture();
  guild.channels.cache.clear();
  try {
    await ensureConfig(guild); await ensureConfig(guild);
    assert.equal(calls.length, 1); assert.equal(calls[0].type, ChannelType.GuildText);
    assert.deepEqual(calls[0].permissionOverwrites[0].deny, [P.ViewChannel]);
    guild.channels.cache.clear(); guild.members.me.permissions.has = () => false;
    await assert.rejects(ensureConfig(guild), /チャンネルの管理/);
  } finally { st.save = original; st.db.clear(); }
});

test('registration failure does not enable unsaved servers; sync failure can be retried', async () => {
  const original = st.save;
  const { guild, i, client } = fixture();
  let saves = 0;
  st.save = async () => ++saves === 1;
  try {
    await setgenshin.execute(i, client);
    assert.equal(isGI(guild.id), false); assert.match(i.result, /登録を保存できません/);
    st.save = async () => true;
    client.rest.put = async () => { throw new Error('Discord unavailable'); };
    await setgenshin.execute(i, client);
    assert.equal(isGI(guild.id), true); assert.match(i.result, /登録は保存しました/);
  } finally { st.save = original; st.db.clear(); }
});

test('global registration excludes Genshin commands and help is scoped to registered guilds', async () => {
  const { guild, client, calls } = fixture();
  st.get(guild.id).genshin = true;
  try {
    await syncAll(client);
    assert.ok(calls[0].body.some(c => c.name === 'setgenshin'));
    assert.ok(calls[0].body.some(c => c.name === 'help'));
    assert.ok(!calls[0].body.some(c => c.name === 'build-card'));
    assert.ok(calls[1].body.some(c => c.name === 'build-card'));
    let output;
    await help.execute({ guildId: guild.id, reply: p => { output = p; } }); assert.equal(output.embeds.length, 2);
    await help.execute({ guildId: 'unregistered', reply: p => { output = p; } }); assert.equal(output.embeds.length, 1);
  } finally { st.db.clear(); }
});
