const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, MessageFlags } = require('discord.js');
const st = require('../utils/store');
const en = require('../utils/enka');
const art = require('../utils/artifact');
const character = require('../utils/character');
const cards = require('../utils/charCard');
const panel = require('../utils/buildPanel');
const bump = require('../utils/bump');
const { GI } = require('../utils/gi');
const interactions = require('../events/interactionCreate');

test('private preview can change bases, characters and score mode before public posting', async () => {
  const original = { player: en.player, names: en.names, build: character.build, card: cards.charCard, saveLater: st.saveLater };
  const builds = [], posts = [];
  en.player = async () => ({ p: {}, raw: [{ avatarId: 1 }, { avatarId: 2 }] });
  en.names = async () => ({ 1: 'ナヒーダ', 2: 'フリーナ' });
  character.build = async (a, uid, base, showScore) => { builds.push({ aid: a.avatarId, base, showScore }); return { name: a.avatarId === 1 ? 'ナヒーダ' : 'フリーナ' }; };
  cards.charCard = async () => Buffer.from('image');
  st.saveLater = () => {};
  const guildId = GI[0];
  st.get(guildId).intro = { user: { uid: '123456789' } };
  const i = { guildId, channelId: 'ch', user: { id: 'user' }, channel: { send: async p => { posts.push(p); return { url: 'https://discord.com/channels/g/c/m' }; } }, customId: 'bc_open_score', deferReply: async () => {}, deferUpdate: async () => {}, editReply: async p => { i.output = p; }, reply: async p => { i.error = p; }, deleteReply: async () => { i.deleted = true; } };
  try {
    await panel.handle(i);
    const id = i.output.components[0].toJSON().components[0].custom_id.split('_')[2];
    const select = async (action, value) => { i.customId = `bc_${action}_${id}`; i.values = [value]; await panel.handle(i); i.output.components?.forEach(r => r.toJSON()); };
    await select('char', '1'); assert.equal(builds.length, 0);
    await select('base', 'em');
    await select('base', 'hp');
    await select('char', '2');
    assert.deepEqual(builds.map(b => [b.aid, b.base]), [[1, 'em'], [1, 'hp'], [2, 'hp']]);
    assert.equal(posts.length, 0);
    await select('toggle'); assert.equal(builds.at(-1).showScore, false); assert.equal(i.output.components.length, 2);
    await select('post'); assert.equal(posts.length, 1);
    const other = { ...i, user: { id: 'other' } };
    await panel.handle(other); assert.match(i.error.content, /有効期限/);
    await select('end'); assert.equal(i.deleted, true);
    await select('char', '1'); assert.match(i.error.content, /有効期限/);
  } finally { Object.assign(en, { player: original.player, names: original.names }); character.build = original.build; cards.charCard = original.card; st.saveLater = original.saveLater; st.db.clear(); }
});

test('no-score card keeps relic main/sub stats and actual renderer accepts missing equipment', async () => {
  const names = en.names; en.names = async () => ({ 1: 'テスト' });
  try {
    const a = { avatarId: 1, fightPropMap: {}, equipList: [{ reliquary: {}, flat: { equipType: 'EQUIP_BRACER', setNameTextMapHash: 'x', reliquaryMainstat: { mainPropId: 'FIGHT_PROP_HP', statValue: 4780 }, reliquarySubstats: [{ appendPropId: 'FIGHT_PROP_CRITICAL', statValue: 10 }] } }] };
    const d = await character.build(a, '123456789', 'hp', false);
    assert.equal(d.showOp, true); assert.equal(d.showScore, false);
    assert.match(d.relics[0].main, /4780/); assert.equal(d.relics[0].subs.length, 1);
    const plain = await cards.charCard(d);
    const scored = await cards.charCard({ ...d, showScore: true });
    assert.equal(plain.subarray(1, 4).toString(), 'PNG'); assert.notDeepEqual(plain, scored);
    const limited = await character.build({ avatarId: 1, lim: true }, '123456789', null, false);
    assert.ok((await cards.charCard(limited)).length > 1000);
  } finally { en.names = names; }
});

test('sticky stays single per channel and stores panel id', async () => {
  const save = st.saveLater; st.saveLater = () => {};
  const sent = [], deleted = [];
  const ch = { id: 'panel-ch', guildId: GI[0], guild: {}, messages: { delete: async id => deleted.push(id) }, send: async p => { sent.push(p); return { id: String(sent.length) }; } };
  try {
    await panel.place(ch, true); await panel.place(ch);
    assert.deepEqual(deleted, ['1']); assert.equal(st.get(ch.guildId).buildPanels[ch.id], '2');
    sent.forEach(p => { assert.equal(p.flags, MessageFlags.SuppressNotifications); p.components.forEach(r => r.toJSON()); });
  } finally { st.saveLater = save; st.db.clear(); }
});

test('bump updates existing message without mentions; repeated ticks do not repeat reminders', async () => {
  const save = st.save; st.save = async () => true;
  const edits = [], sent = [];
  const ch = { messages: { fetch: async () => ({ edit: async p => { edits.push(p); return {}; } }) }, send: async p => { sent.push(p); return { id: 'new' }; } };
  const g = { id: 'bump-guild', channels: { cache: new Collection([['ch', ch]]) } };
  const client = { guilds: { cache: new Collection([[g.id, g]]) } };
  st.get(g.id).bump = { ch: 'ch', msg: 'old', at: Date.now() - 7201000, rem: false };
  try {
    await bump.tick(client); await bump.tick(client);
    assert.equal(edits.length, 1); assert.equal(sent.length, 0); assert.equal(edits[0].content, ''); assert.deepEqual(edits[0].allowedMentions.parse, []);
    ch.messages.fetch = async () => null;
    st.get(g.id).bump.rem = false;
    await bump.tick(client);
    assert.equal(sent[0].flags, MessageFlags.SuppressNotifications);
    assert.deepEqual(sent[0].allowedMentions.parse, []);
    ch.send = async () => { throw new Error('missing permissions'); };
    st.get(g.id).bump.rem = false;
    await bump.tick(client); assert.equal(st.get(g.id).bump.rem, false);
  } finally { st.save = save; st.db.clear(); }
});

test('announce removes success reply, while failed image warning stays visible', async () => {
  const make = image => {
    const i = { customId: 'ann_mdl_123', user: { id: 'u' }, guildId: 'g', channelId: 'c',
      isChatInputCommand: () => false, isRoleSelectMenu: () => false, isStringSelectMenu: () => false, isButton: () => false, isModalSubmit: () => true,
      deferReply: async () => {}, deleteReply: async () => { i.deleted = true; }, editReply: async p => { i.warning = p; },
      fields: { getTextInputValue: () => '本文', getUploadedFiles: () => ({ first: () => image }) },
      guild: { roles: { cache: new Collection() } }, channel: { send: async p => { i.post = p; return { id: 'm' }; } } };
    return i;
  };
  const client = () => ({ commands: new Collection([['announce', { pend: new Map([['123', { ids: [], sticky: false }]]) }]]) });
  const success = make(); await interactions.execute(success, client());
  assert.equal(success.deleted, true); assert.equal(success.warning, undefined); assert.ok(success.post);
  const fetch = global.fetch; global.fetch = async () => { throw new Error('image unavailable'); };
  try {
    const warning = make({ contentType: 'image/png', url: 'https://example.test/image.png' });
    await interactions.execute(warning, client());
    assert.equal(warning.deleted, undefined); assert.match(warning.warning.embeds[0].toJSON().description, /⚠️/);
  } finally { global.fetch = fetch; }
});
