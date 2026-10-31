const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, PermissionFlagsBits } = require('discord.js');
const st = require('../utils/store');
const dir = require('../utils/serverDirectory');

test('directory renders owner mentions and existing invite without creating an invite', async () => {
  let requests = 0;
  const g = {name:'サーバーA',id:'111111111111111111',ownerId:'222222222222222222',
    members:{me:{permissions:{has:v=>v===PermissionFlagsBits.ManageGuild}}},
    invites:{fetch:async()=>{requests++;return new Collection([['x',{code:'alreadyExists',uses:0,maxUses:0,expiresAt:null}]]);}}};
  const result=await dir.info(g);
  assert.equal(requests,1);
  assert.equal(result.invite,'https://discord.gg/alreadyExists');
  assert.match(dir.makePages([result])[0].data.description, /<@222222222222222222>/);
});

test('directory omits invitations when permissions are absent', async () => {
  const g={id:'123',name:'restricted',ownerId:'456',
    members:{me:{permissions:{has:()=>false}}},
    invites:{fetch:async()=>{throw Error('must not fetch');}}};
  const data=await dir.info(g);
  assert.equal(data.invite,null);
});

test('guild join sends notification to saved channel without pinging owner', async () => {
  st.db.clear();
  const sent=[];
  const home={id:'home',channels:{fetch:async()=>({isTextBased:()=>true,send:async msg=>sent.push(msg)})}};
  const incoming={id:'new',name:'New Guild',ownerId:'987654321098765432',
    members:{me:{permissions:{has:()=>false}}},client:{guilds:{cache:new Collection([['home',home],['new',null]])}}};
  incoming.client.guilds.cache.set('new',incoming);
  st.get('home').serverJoinNotifyChannelId='channel-id';
  try{
    await dir.notifyJoin(incoming);
    assert.equal(sent.length,1);
    assert.deepEqual(sent[0].allowedMentions,{parse:[]});
    assert.match(sent[0].embeds[0].data.description,/987654321098765432/);
  }finally{st.db.clear();}
});
