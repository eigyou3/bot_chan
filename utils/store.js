const { AttachmentBuilder, MessageFlags } = require('discord.js');

// 各サーバーの #bot-config に config.json を置いて保存する
const CH_NAME = 'bot-config';
const FILE = 'config.json';

const db = new Map();    // guildId -> data
const last = new Map();  // guildId -> 保存メッセージID
const tmr = new Map();   // 遅延保存用
const q = new Map();     // 保存の順番待ち
const failures = new Map(); // guildId -> 最後の保存失敗理由

const blank = () => ({ vc: null, sticky: {}, alarms: [], entry: {}, welcome: {} });

function findCh(g) {
  return g.channels.cache.find(c => c.name === CH_NAME && c.isTextBased());
}

function get(gid) {
  if (!db.has(gid)) db.set(gid, blank());
  return db.get(gid);
}

async function load(g) {
  const ch = findCh(g);
  if (!ch) return;
  const msgs = await ch.messages.fetch({ limit: 20 }).catch(() => null);
  if (!msgs) return;
  const m = msgs.find(x => x.author.id === g.client.user.id && x.attachments.some(a => a.name === FILE));
  if (!m) return;
  try {
    const url = m.attachments.find(a => a.name === FILE).url;
    const d = await (await fetch(url)).json();
    db.set(g.id, { ...blank(), ...d });
    last.set(g.id, m.id);
  } catch (e) {
    console.error(`読み込み失敗 ${g.name}:`, e.message);
  }
}

async function loadAll(client) {
  for (const g of client.guilds.cache.values()) await load(g);
}

async function write(g) {
  const ch = findCh(g);
  if (!ch) throw new Error('#bot-config が見つかりません。/setup で準備してください。');
  const me = g.members?.me;
  if (me && ch.permissionsFor) {
    const { PermissionFlagsBits: P } = require('discord.js');
    const needed = [[P.ViewChannel, 'チャンネルを見る'], [P.SendMessages, 'メッセージを送信'], [P.ReadMessageHistory, 'メッセージ履歴を読む'], [P.AttachFiles, 'ファイルを添付']];
    const perms = ch.permissionsFor(me);
    const missing = needed.filter(([flag]) => !perms?.has(flag)).map(([, label]) => label);
    if (missing.length) throw new Error(`#bot-config でBotの権限が不足しています：${missing.join('・')}`);
  }
  const buf = Buffer.from(JSON.stringify(get(g.id), null, 2));
  const f = new AttachmentBuilder(buf, { name: FILE });
  const content = `Botの設定保存用ファイルです。この投稿は設定変更時に更新されます。\n最終保存：<t:${Math.floor(Date.now() / 1000)}:F>\nこのチャンネルとファイルは削除しないでください。`;

  // 前のがあればファイルを差し替えて編集（新規投稿しない）
  const old = last.get(g.id) && await ch.messages.fetch(last.get(g.id)).catch(() => null);
  if (old) {
    const ok = await old.edit({ content, files: [f], attachments: [] }).catch(() => null);
    if (ok) return true;
  }

  const m = await ch.send({ content, files: [f], flags: MessageFlags.SuppressNotifications });
  last.set(g.id, m.id);
  return true;
}

// 書き込みが被らないよう順番に
function save(g) {
  const p = (q.get(g.id) || Promise.resolve())
    .then(async () => { await write(g); failures.delete(g.id); return true; })
    .catch(e => { failures.set(g.id, e.message); console.error(`設定保存失敗 ${g.name} (${g.id}):`, e.message); return false; });
  q.set(g.id, p);
  return p;
}

// stickyみたいに頻繁に変わるやつはまとめて保存
function saveLater(g, ms = 15000) {
  clearTimeout(tmr.get(g.id));
  tmr.set(g.id, setTimeout(() => save(g), ms));
}

// bot-config無い時の注意書き
const warn = g => failures.has(g.id) ? `\n⚠️ 設定を保存できていません：${failures.get(g.id)}` : findCh(g) ? '' : `\n⚠️ #${CH_NAME} が無いので再起動すると消えます`;

module.exports = { CH_NAME, db, get, findCh, loadAll, save, saveLater, warn };
