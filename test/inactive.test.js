const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, PermissionFlagsBits: P } = require('discord.js');
const st = require('../utils/store');
const inactive = require('../utils/inactive');
const command = require('../commands/inactive');
const DAY = 86400000;
const NOW = Date.parse('2026-10-30T12:00:00Z');

function fixture() {
  const logs = [], warnings = [], kicks = [];
  const started = Date.parse('2026-06-30T12:00:00Z');
  const channel = { permissionsFor: () => ({ has: () => true }), send: async p => logs.push(p) };
  const guild = { id: 'inactivity-test', name: 'テストサーバー', ownerId: 'owner', channels: { cache: new Collection([['log', channel]]) } };
  const member = { id: 'member', guild, user: { id: 'member', bot: false }, joinedTimestamp: started - DAY, voice: {}, kickable: true, permissions: { has: () => false }, roles: { cache: new Collection() }, send: async p => warnings.push(p), kick: async reason => kicks.push(reason) };
  const members = new Collection([[member.id, member]]);
  guild.members = { me: { permissions: { has: () => true } }, fetch: async options => options ? member : members };
  const s = st.get(guild.id).inactive = { enabled: true, since: started, seenAt: NOW, checkedAt: 0, log: 'log', exclude: null, users: {} };
  return { guild, member, members, s, logs, warnings, kicks };
}

function click(f, action, token, user = 'member') {
  const i = { customId: `ia_${action}_${f.guild.id}_member_${token}`, user: { id: user }, deferUpdate: async () => {}, editReply: async p => { i.result = p; }, update: async p => { i.result = p; }, reply: async p => { i.result = p; } };
  const client = { guilds: { cache: new Collection([[f.guild.id, f.guild]]) } };
  return { i, run: () => inactive.handleButton(i, client) };
}

test('keep button survives restart, resets three months and cannot be replayed', async () => {
  const save = st.save, clock = Date.now; st.save = async () => true; Date.now = () => NOW;
  const f = fixture();
  try {
    await inactive.sweep(f.guild, NOW);
    assert.deepEqual(f.warnings[0].components[0].toJSON().components.map(b => b.label), ['参加を続ける', '退出する']);
    const token = f.s.users.member.warningToken;
    st.get(f.guild.id).inactive = JSON.parse(JSON.stringify(f.s));
    const c = click(f, 'keep', token); await c.run();
    const restored = st.get(f.guild.id).inactive;
    assert.equal(restored.users.member.at, NOW); assert.equal(restored.users.member.warningAt, undefined);
    assert.match(c.i.result.content, /キック予定は解除/); assert.equal(f.kicks.length, 0);
    const old = click(f, 'keep', token); await old.run(); assert.match(old.i.result.content, /終了/);
    assert.ok(f.logs.some(p => /参加を続ける/.test(p.embeds[0].toJSON().description)));
    restored.seenAt = NOW + 8 * DAY;
    await inactive.sweep(f.guild, restored.seenAt); assert.equal(f.kicks.length, 0);
  } finally { st.save = save; Date.now = clock; st.db.clear(); }
});

test('leave requires separate confirmation token; back and wrong user never kick', async () => {
  const save = st.save, clock = Date.now; st.save = async () => true; Date.now = () => NOW;
  const f = fixture();
  try {
    await inactive.sweep(f.guild, NOW);
    const token = f.s.users.member.warningToken;
    const wrong = click(f, 'leave', token, 'someone-else'); await wrong.run(); assert.match(wrong.i.result.content, /本人だけ/);
    const forged = click(f, 'confirm', token); await forged.run(); assert.equal(f.kicks.length, 0);
    const leave = click(f, 'leave', token); await leave.run();
    assert.equal(f.kicks.length, 0);
    const confirmation = f.s.users.member.confirmToken;
    assert.notEqual(confirmation, token);
    const back = click(f, 'back', confirmation); await back.run();
    assert.deepEqual(back.i.result.components[0].toJSON().components.map(b => b.label), ['参加を続ける', '退出する']);
    await leave.run();
    const confirm = click(f, 'confirm', f.s.users.member.confirmToken); await confirm.run();
    assert.equal(f.kicks.length, 1); assert.match(confirm.i.result.content, /退出しました/);
    await confirm.run(); assert.equal(f.kicks.length, 1);
  } finally { st.save = save; Date.now = clock; st.db.clear(); }
});

test('expired confirmation restores choices, failed persistence never kicks, disabled monitor rejects old buttons', async () => {
  const save = st.save, clock = Date.now; st.save = async () => true; Date.now = () => NOW;
  const f = fixture();
  try {
    await inactive.sweep(f.guild, NOW);
    const token = f.s.users.member.warningToken;
    await click(f, 'leave', token).run();
    const old = f.s.users.member.confirmToken;
    Date.now = () => NOW + 11 * 60000;
    const expired = click(f, 'confirm', old); await expired.run();
    assert.match(expired.i.result.content, /有効期限/); assert.equal(f.kicks.length, 0);
    await click(f, 'leave', token).run();
    const confirm = click(f, 'confirm', f.s.users.member.confirmToken);
    st.save = async () => false;
    await confirm.run(); assert.equal(f.kicks.length, 0); assert.equal(f.s.enabled, false);
    const keep = click(f, 'keep', token); await keep.run(); assert.match(keep.i.result.content, /終了/);
  } finally { st.save = save; Date.now = clock; st.db.clear(); }
});

test('automation is opt-in, owner can enable with saved configuration and disable immediately', async () => {
  const save = st.save; st.save = async () => true;
  const { guild } = fixture();
  delete st.get(guild.id).inactive;
  let sub = 'enable', output;
  const i = { guildId: guild.id, guild, user: { id: '1088369918069715024' }, options: { getSubcommand: () => sub, getChannel: () => ({ id: 'log', permissionsFor: () => ({ has: () => true }) }), getRole: () => ({ id: 'excluded-role' }) }, deferReply: async () => {}, editReply: async p => { output = p; } };
  try {
    await inactive.sweep(guild, NOW); assert.equal(st.get(guild.id).inactive, undefined);
    command.data.toJSON();
    await command.execute(i);
    assert.equal(st.get(guild.id).inactive.enabled, true);
    assert.equal(st.get(guild.id).inactive.exclude, 'excluded-role');
    assert.match(output.embeds[0].toJSON().description, /警告DM/);
    sub = 'disable'; await command.execute(i);
    assert.equal(st.get(guild.id).inactive.enabled, false);
    sub = 'enable'; st.save = async () => false;
    await command.execute(i); assert.equal(st.get(guild.id).inactive.enabled, false);
  } finally { st.save = save; st.db.clear(); }
});

test('calendar months clamp month-end correctly', () => {
  assert.equal(new Date(inactive.threeMonths(Date.parse('2026-01-31T10:00:00+09:00'))).toISOString(), '2026-04-30T01:00:00.000Z');
});

test('no kick before warning or grace; after seven days fresh eligibility is checked', async () => {
  const save = st.save, clock = Date.now; st.save = async () => true; Date.now = () => NOW;
  const { guild, s, warnings, kicks } = fixture();
  try {
    await inactive.sweep(guild, NOW);
    assert.equal(warnings.length, 1); assert.equal(kicks.length, 0);
    assert.equal(s.users.member.warningAt, NOW);
    s.seenAt = NOW + 6 * DAY; Date.now = () => s.seenAt;
    await inactive.sweep(guild, s.seenAt); assert.equal(kicks.length, 0);
    s.seenAt = NOW + 7 * DAY; Date.now = () => s.seenAt;
    await inactive.sweep(guild, s.seenAt); assert.equal(kicks.length, 1);
  } finally { st.save = save; Date.now = clock; st.db.clear(); }
});

test('DM failure never authorizes a kick', async () => {
  const save = st.save, clock = Date.now; st.save = async () => true; Date.now = () => NOW;
  const { guild, member, s, kicks, logs } = fixture();
  member.send = async () => { throw new Error('DM blocked'); };
  try {
    await inactive.sweep(guild, NOW);
    assert.equal(s.users.member.warningAt, undefined); assert.ok(s.users.member.dmFailedAt);
    s.seenAt = NOW + 8 * DAY; Date.now = () => s.seenAt;
    await inactive.sweep(guild, s.seenAt);
    assert.equal(kicks.length, 0); assert.match(logs[0].embeds[0].toJSON().description, /キックしません/);
  } finally { st.save = save; Date.now = clock; st.db.clear(); }
});

test('message or VC activity cancels warning; bots, admins, owners, exempt roles, new members and live VC are excluded', () => {
  const { guild, member, s } = fixture();
  s.users.member = { warningAt: NOW - 8 * DAY };
  inactive.record(guild, member.user, NOW);
  assert.equal(s.users.member.warningAt, undefined); assert.equal(inactive.eligible(member, s, NOW), false);
  delete s.users.member;
  assert.equal(inactive.eligible(member, s, NOW), true);
  for (const variant of [
    { user: { id: 'member', bot: true } }, { id: 'owner' },
    { user: { id: '1088369918069715024' } }, { permissions: { has: () => true } },
    { voice: { channelId: 'vc' } }, { kickable: false }, { joinedTimestamp: NOW - DAY },
  ]) assert.equal(inactive.eligible({ ...member, ...variant }, s, NOW), false);
  s.exclude = 'exclude'; member.roles.cache.set('exclude', {});
  assert.equal(inactive.eligible(member, s, NOW), false);
  st.db.clear();
});

test('offline period resets observation instead of assuming inactivity; persistence failure stops automation', async () => {
  const save = st.save; st.save = async () => true;
  const { guild, s, warnings, kicks } = fixture();
  s.seenAt = NOW - 3600000;
  try {
    await inactive.sweep(guild, NOW);
    assert.equal(s.since, NOW); assert.equal(warnings.length, 0); assert.equal(kicks.length, 0);
    st.save = async () => false;
    s.checkedAt = 0;
    await inactive.sweep(guild, NOW + 60000);
    assert.equal(s.enabled, false); assert.equal(kicks.length, 0);
  } finally { st.save = save; st.db.clear(); }
});

test('activity or disabling during final fetch prevents kick; concurrent checks do not send duplicate warnings', async () => {
  const save = st.save, clock = Date.now; st.save = async () => true; Date.now = () => NOW;
  let f = fixture();
  try {
    await Promise.all([inactive.sweep(f.guild, NOW), inactive.sweep(f.guild, NOW)]);
    assert.equal(f.warnings.length, 1);
    f.s.seenAt = NOW + 8 * DAY; Date.now = () => f.s.seenAt;
    f.guild.members.fetch = async options => {
      if (options) { inactive.record(f.guild, f.member.user, f.s.seenAt); return f.member; }
      return f.members;
    };
    await inactive.sweep(f.guild, f.s.seenAt); assert.equal(f.kicks.length, 0);
    st.db.clear(); f = fixture();
    f.s.users.member = { warningAt: NOW - 8 * DAY, warningToken: 'test-token' };
    Date.now = () => NOW;
    f.guild.members.fetch = async options => { if (options) { f.s.enabled = false; return f.member; } return f.members; };
    await inactive.sweep(f.guild, NOW); assert.equal(f.kicks.length, 0);
  } finally { st.save = save; Date.now = clock; st.db.clear(); }
});
