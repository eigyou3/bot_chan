const { EmbedBuilder } = require('discord.js');
const st = require('./store');

// 週間VCランキング
// 集計は日曜21:00区切り、人間2人以上いる時だけカウント（botは数えない）
// ひとりで30分以上 → 特賞

const SOLO_MIN = 30 * 60;
const KING = '今週のVC王';
const SOLO_KING = 'ソロでもプレイ王';
const COLOR = '#534AB7';

const busy = new Map();  // bump連打防止
const lastSv = new Map();

const blankWk = wk => ({ wk, calls: 0, total: 0, start: {}, last: {}, time: {}, solo: {} });

// 直近の日曜21:00(JST)
function weekStart(t = Date.now()) {
  const j = new Date(t + 9 * 3600000);
  const d = new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate(), 21));
  d.setUTCDate(d.getUTCDate() - j.getUTCDay());
  if (d > j) d.setUTCDate(d.getUTCDate() - 7);
  return d.getTime() - 9 * 3600000;
}

function fmt(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? `${h}時間${String(m).padStart(2, '0')}分` : `${m}分`;
}

function day(ms) {
  const j = new Date(ms + 9 * 3600000);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()}（${'日月火水木金土'[j.getUTCDay()]}）21:00`;
}

function vd(gid) {
  const d = st.get(gid);
  if (!d.vcr) d.vcr = { cur: blankWk(weekStart()), sess: {}, msg: null, res: null, ts: Date.now() };
  return d.vcr;
}

const humans = ch => ch.members.filter(m => !m.user.bot);
const add = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };

// 前回からの経過分を足し込む
function accrue(g, now = Date.now()) {
  const r = vd(g.id);
  const dt = Math.max(0, (now - r.ts) / 1000);
  r.ts = now;
  // イベントは抜けた後の状態で来るので、前回覚えた顔ぶれで数える
  for (const s of Object.values(r.sess)) {
    const hs = s.hs || [];
    if (hs.length >= 2) {
      r.cur.total += dt;
      hs.forEach(id => add(r.cur.time, id, dt));
    } else if (hs.length === 1 && s.solo) {
      s.soloT = (s.soloT || 0) + dt;
    }
  }
}

// ひとり時間の区切り
function endSolo(r, s) {
  if (s.solo && (s.soloT || 0) >= SOLO_MIN) add(r.cur.solo, s.solo, s.soloT);
  s.solo = null;
  s.soloT = 0;
}

// VCの状態に合わせてセッションを更新
function sync(g, cid, leaver) {
  const r = vd(g.id);
  const ch = g.channels.cache.get(cid);
  if (!ch || cid === g.afkChannelId) return;
  const hs = humans(ch);
  let s = r.sess[cid];

  if (!hs.size) {
    if (s) {
      endSolo(r, s);
      if (s.multi && leaver) add(r.cur.last, leaver);
      delete r.sess[cid];
    }
    return;
  }

  if (!s) s = r.sess[cid] = { starter: hs.first().id, since: Date.now(), multi: false, solo: null, soloT: 0 };
  s.hs = [...hs.keys()];

  if (hs.size >= 2) {
    endSolo(r, s);
    if (!s.multi) {
      s.multi = true;
      r.cur.calls++;
      if (s.starter) add(r.cur.start, s.starter);
    }
  } else {
    const id = hs.first().id;
    if (s.solo !== id) { endSolo(r, s); s.solo = id; }
  }
}

async function onVoice(o, n) {
  const g = n.guild;
  if (n.member?.user.bot) return;
  if (o.channelId === n.channelId) return;
  if (!st.get(g.id).vc) return;
  await rollover(g);
  accrue(g);
  if (o.channelId) sync(g, o.channelId, n.member.id);
  if (n.channelId) sync(g, n.channelId);
  st.saveLater(g);
  await draw(g);
}

// 1位（同率は全部）
function top(o) {
  const v = Math.max(0, ...Object.values(o));
  if (!v) return { v: 0, ids: [] };
  return { v, ids: Object.keys(o).filter(k => o[k] === v) };
}

function build(g, w, done) {
  const r = vd(g.id);
  const ms = ids => ids.map(i => `<@${i}>`).join('・');
  const row = (o, f) => { const t = top(o); return t.ids.length ? `${ms(t.ids)}　${f(t.v)}` : 'まだいないよ'; };

  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(done ? '先週のVCランキング（確定）' : '今週のVCランキング（途中経過）')
    .setDescription(`${day(w.wk)} 〜 ${day(w.wk + 7 * 86400000)}`)
    .addFields(
      { name: '通話回数', value: `${w.calls}回`, inline: true },
      { name: '通話時間', value: fmt(w.total), inline: true },
      { name: '​', value: '​', inline: true },
      { name: '📞 通話を始めた回数', value: row(w.start, v => `${v}回`) },
      { name: '🚪 最後まで残った回数', value: row(w.last, v => `${v}回`) },
      { name: '⏱ 通話時間', value: row(w.time, fmt) },
    );

  // 特賞は確定版だけ（途中は伏せとく）
  const sl = Object.entries(w.solo).sort((a, b) => b[1] - a[1]);
  if (done && sl.length) {
    e.addFields({ name: '🏅 特賞　ひとりでもVC賞', value: sl.map(([i, t]) => `<@${i}>　ひとりで${fmt(t)}`).join('\n') });
  }

  if (!done) {
    const now = Object.entries(r.sess)
      .map(([cid, s]) => [g.channels.cache.get(cid), s])
      .filter(([c]) => c && humans(c).size)
      .map(([c, s]) => `🔊 ${c.name}　${humans(c).size}人（<t:${Math.floor(s.since / 1000)}:R>から）`);
    if (now.length) e.addFields({ name: 'いま通話中', value: now.join('\n') });
    e.setFooter({ text: '日曜 21:00 に確定' });
  }
  return e;
}

// 途中経過のEmbedを書き換え（無ければ投稿）
async function draw(g) {
  const d = st.get(g.id);
  const ch = d.vc && g.channels.cache.get(d.vc);
  if (!ch) return;
  const r = vd(g.id);
  const emb = build(g, r.cur, false);
  const m = r.msg && await ch.messages.fetch(r.msg).catch(() => null);
  if (m) return m.edit({ embeds: [emb] }).catch(() => null);
  const nw = await ch.send({ embeds: [emb] }).catch(() => null);
  if (nw) { r.msg = nw.id; st.saveLater(g); }
}

// 一番下に持ってくる
async function bump(g) {
  const d = st.get(g.id);
  const ch = d.vc && g.channels.cache.get(d.vc);
  if (!ch || busy.get(g.id)) return;
  busy.set(g.id, true);
  try {
    const r = vd(g.id);
    if (r.msg) await ch.messages.delete(r.msg).catch(() => null);
    r.msg = null;
    await draw(g);
  } finally {
    busy.set(g.id, false);
  }
}

async function roles(g, w) {
  const k = g.roles.cache.find(x => x.name === KING);
  const s = g.roles.cache.find(x => x.name === SOLO_KING);
  if (!k && !s) return;
  await g.members.fetch().catch(() => null);

  if (k) {
    const win = new Set([...top(w.start).ids, ...top(w.last).ids, ...top(w.time).ids]);
    for (const m of k.members.values()) if (!win.has(m.id)) await m.roles.remove(k).catch(() => null);
    for (const id of win) await g.members.cache.get(id)?.roles.add(k).catch(() => null);
  }
  // ソロ王は付けるだけ
  if (s) for (const id of Object.keys(w.solo)) await g.members.cache.get(id)?.roles.add(s).catch(() => null);
}

// 週の切り替え
async function rollover(g) {
  const r = vd(g.id);
  const wk = weekStart();
  if (r.cur.wk === wk) return false;

  accrue(g, r.cur.wk + 7 * 86400000);
  for (const s of Object.values(r.sess)) endSolo(r, s);
  const old = r.cur;

  const d = st.get(g.id);
  const ch = d.vc && g.channels.cache.get(d.vc);
  if (ch) {
    if (r.msg) await ch.messages.delete(r.msg).catch(() => null);
    if (r.res) await ch.messages.delete(r.res).catch(() => null);
    const m = await ch.send({ embeds: [build(g, old, true)] }).catch(() => null);
    r.res = m?.id || null;
  }
  r.msg = null;
  await roles(g, old);

  // 続いてる通話は新しい週に持ち越し（回数は数え直さない）
  r.cur = blankWk(wk);
  r.ts = Date.now();
  await draw(g);
  await st.save(g);
  return true;
}

// 起動時：保存してたセッションと今のVCを突き合わせ
async function init(client) {
  for (const g of client.guilds.cache.values()) {
    if (!st.get(g.id).vc) continue;
    const r = vd(g.id);
    r.ts = Date.now();  // 落ちてた間は数えない
    for (const cid of Object.keys(r.sess)) {
      const ch = g.channels.cache.get(cid);
      if (!ch || !humans(ch).size) delete r.sess[cid];
    }
    g.channels.cache.filter(c => c.isVoiceBased() && c.id !== g.afkChannelId && humans(c).size).forEach(c => {
      if (!r.sess[c.id]) r.sess[c.id] = { starter: null, since: Date.now(), multi: humans(c).size >= 2, solo: null, soloT: 0 };
      sync(g, c.id);
    });
    await rollover(g);
    await draw(g);
  }
}

// 毎分：通話中なら書き換え、週替わりチェック
async function tick(client) {
  for (const g of client.guilds.cache.values()) {
    if (!st.get(g.id).vc) continue;
    await rollover(g);
    const r = vd(g.id);
    if (!Object.keys(r.sess).length) continue;
    accrue(g);
    for (const cid of Object.keys(r.sess)) sync(g, cid);
    await draw(g);
    // 通話中の保存は5分おき
    if (Date.now() - (lastSv.get(g.id) || 0) > 300000) {
      lastSv.set(g.id, Date.now());
      st.saveLater(g, 1000);
    }
  }
}

module.exports = { onVoice, bump, init, tick, humans };
