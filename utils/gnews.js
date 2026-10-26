const { EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const st = require('./store');
const { isAdmin, deny } = require('./perm');
const { GI } = require('./gi');

// 原神のゲーム内お知らせ
const URL = 'https://sg-hk4e-api.hoyoverse.com/common/hk4e_global/announcement/api/getAnnContent?game=hk4e&game_biz=hk4e_global&lang=ja&bundle_id=hk4e_global&platform=pc&region=os_asia&level=55&uid=100000000';
const COLOR = '#5F5E5A';

const box = t => new EmbedBuilder().setColor(COLOR).setDescription(t);

const unesc = s => String(s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

// 本文HTML → 行。日時タグは [[2026/10/26 04:00]] にしとく
function lines(html) {
  let s = unesc(unesc(html));
  s = s.replace(/<t class="t_(?:lc|gl)"[^>]*>\s*([^<]*?)\s*<\/t>/g, '[[$1]]');
  s = s.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/g, '\n').replace(/<[^>]+>/g, '');
  return s.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// 見出し〓〜〓の中身
function sec(ls, re) {
  const i = ls.findIndex(l => re.test(l));
  if (i < 0) return null;
  const out = [];
  const first = ls[i].replace(re, '').replace(/^[：:]/, '').trim();
  if (first) out.push(first);
  for (let j = i + 1; j < ls.length && !/^〓/.test(ls[j]); j++) out.push(ls[j]);
  return out;
}

// UTC+8 の日時 → unix
function ts(y, mo, d, h = 0, mi = 0) {
  return Math.floor(Date.UTC(+y, +mo - 1, +d, +h - 8, +mi) / 1000);
}

function dates(t) {
  const out = [];
  const re = /\[\[(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\]\]|(\d{4})年(\d{1,2})月(\d{1,2})日\s*(?:(\d{1,2}):(\d{2}))?/g;
  let m;
  while ((m = re.exec(t))) {
    out.push({ at: m.index, tag: !!m[1], v: m[1] ? ts(m[1], m[2], m[3], m[4], m[5]) : ts(m[6], m[7], m[8], m[9] || 0, m[10] || 0) });
  }
  return out;
}

// 「Ver.7.1アップデート後」みたいなところだけ抜く
const verTxt = t => (t.match(/(Ver\.?\s*[\d.]+|[\d.]+\s*バージョン)\s*(アップデート|アップ)後(より開放)?/) || [])[0] || '開催中';

// 期間：日付2つ以上なら最後の2つ、1つなら終わりだけ（開始は文字のまま）
// 期間：日時タグが2つ以上なら最初の2つ（後ろに別の期間が続くことがある）
// 文章の日付だけの時は、終わり＝最後、始まり＝Asiaの後ろのもの
function period(ls) {
  if (!ls) return null;
  const t = ls.join(' ');
  const ds = dates(t);
  if (!ds.length) return null;
  const tg = ds.filter(d => d.tag);
  if (tg.length >= 2) {
    // 1つ目の前に「アップデート後」があれば、それは終わりの日付だけ
    if (/アップデート後|アップ後/.test(t.slice(0, tg[0].at))) return { st: verTxt(t.slice(0, tg[0].at)), e: tg[0].v };
    return { s: tg[0].v, e: tg[1].v };
  }
  if (tg.length === 1) {
    const before = t.slice(0, tg[0].at);
    return /[～~〜]\s*$/.test(before.trim()) ? { st: verTxt(before), e: tg[0].v } : { st: '開催中', e: tg[0].v };
  }
  const end = ds[ds.length - 1].v;
  if (ds.length === 1) return { st: verTxt(t.slice(0, ds[0].at)), e: end };
  const ai = t.indexOf('Asia');
  const st = (ai >= 0 && ds.find(d => d.at > ai && d !== ds[ds.length - 1])) || ds[0];
  return { s: st.v, e: end };
}

const clean = l => l.replace(/^[●・\-－]\s*/, '').trim();

function parse(it) {
  const ls = lines(it.content);
  const title = String(it.title || '').trim();

  // ガチャ
  if (/^イベント祈願/.test(title)) {
    const p = period(sec(ls, /〓祈願詳細〓/) || ls);
    if (!p) return null;
    const pick = k => {
      const l = ls.find(x => /^●/.test(x) && x.includes(k) && /確率/.test(x));
      return l ? [...l.matchAll(/「([^」]+)」/g)].map(m => m[1]) : [];
    };
    return { id: it.ann_id, kind: 'g', title: title.split('：')[0], banner: it.banner, ...p, p5: pick('★5'), p4: pick('★4') };
  }

  // メンテやお知らせは流さない
  if (/アップデートと調整|メンテナンス|お知らせ$|アンケート|一覧$|最新情報/.test(title)) return null;

  // イベント（期間が書いてあるものだけ）
  const ps = sec(ls, /〓イベント期間〓/) || sec(ls, /^イベント期間[：:]/) || ls.slice(0, 6).filter(l => /アップデート後|\[\[/.test(l));
  const p = period(ps && ps.length ? ps.slice(0, 6) : null);
  if (!p) return null;
  const cond = (sec(ls, /〓(参加|招待)条件〓/) || []).map(clean).filter(l => l && !/^※/.test(l)).slice(0, 5).map(l => l.slice(0, 120));
  return { id: it.ann_id, kind: 'e', title, banner: it.banner, ...p, cond };
}

function embed(a) {
  const span = a.s ? `<t:${a.s}:f> ～ <t:${a.e}:f>` : `${a.st} ～ <t:${a.e}:f>`;
  let t = `## ${a.title}\n**${a.kind === 'g' ? '祈願期間' : 'イベント期間'}**\n${span}\n<t:${a.e}:R>に終了`;
  if (a.kind === 'g') {
    if (a.p5.length) t += `\n**ピックアップ★5**\n${a.p5.map(x => `- ${x}`).join('\n')}`;
    if (a.p4.length) t += `\n**ピックアップ★4**\n${a.p4.map(x => `- ${x}`).join('\n')}`;
  } else if (a.cond.length) {
    t += `\n**参加条件**\n${a.cond.map(x => `- ${x}`).join('\n')}`;
  }
  const e = box(t.slice(0, 4000));
  if (a.banner) e.setImage(a.banner);
  return e;
}

async function fetchAll() {
  try {
    const j = await fetch(URL, { headers: { 'User-Agent': 'bot_chan/1.0' } }).then(r => r.json());
    if (j?.retcode !== 0) return null;
    return j.data?.list || [];
  } catch (e) {
    console.error('お知らせの取得失敗:', e.message);
    return null;
  }
}

// 1サーバー分：新しいのを流す＋終わったのを消す
async function run(g, list) {
  const d = st.get(g.id);
  const n = d.gnews;
  if (!n?.ch) return;
  const ch = g.channels.cache.get(n.ch);
  if (!ch) return;
  const now = Date.now() / 1000;
  let dirty = false;

  // 終わったものは消す
  for (const [id, p] of Object.entries(n.posts)) {
    if (p.e > now) continue;
    await ch.messages.delete(p.msg).catch(() => null);
    if (p.ping) await ch.messages.delete(p.ping).catch(() => null);
    delete n.posts[id];
    dirty = true;
  }

  if (list) {
    const fresh = list.filter(it => !n.seen.includes(it.ann_id)).map(parse).filter(a => a && a.e > now)
      .sort((x, y) => (x.s || 0) - (y.s || 0));
    for (const [k, a] of fresh.entries()) {
      const m = await ch.send({ embeds: [embed(a)] }).catch(e => { console.error('お知らせ投稿失敗:', e.message); return null; });
      if (!m) continue;
      n.posts[a.id] = { msg: m.id, e: a.e };
      // 連続した時はメンションは最後の後だけ、別の投稿で
      if (k === fresh.length - 1 && n.role) {
        const pg = await ch.send({ content: `<@&${n.role}>`, allowedMentions: { roles: [n.role] } }).catch(() => null);
        if (pg) n.posts[a.id].ping = pg.id;
      }
    }
    // 見たものは全部覚える（今のお知らせに無いのは忘れる）
    const ids = list.map(it => it.ann_id);
    n.seen = ids;
    dirty = true;
  }

  if (dirty) await st.save(g);
}

async function tick(client) {
  const gs = [...client.guilds.cache.values()].filter(g => GI.includes(g.id) && st.get(g.id).gnews?.ch);
  if (!gs.length) return;
  const list = await fetchAll();
  for (const g of gs) await run(g, list).catch(e => console.error('お知らせエラー:', e.message));
}

// /setgenshinnews
async function set(i) {
  if (!GI.includes(i.guildId)) return i.reply({ embeds: [box('❌ このサーバーではこのコマンドを使用できません。')], ephemeral: true });
  if (!isAdmin(i)) return deny(i);
  const menu = new RoleSelectMenuBuilder().setCustomId('gn_role').setPlaceholder('メンションするロールを選ぶ');
  const none = new ButtonBuilder().setCustomId('gn_none').setLabel('メンションしない').setStyle(ButtonStyle.Secondary);
  return i.reply({
    embeds: [box('このチャンネルに原神のお知らせ（イベント・祈願）を流すよ。\n新しいお知らせのときにメンションするロールを選んでね。')],
    components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(none)],
    ephemeral: true,
  });
}

// ロールを選んだ／メンションしない → 設定して今のお知らせを流す
async function pick(i) {
  if (!isAdmin(i)) return deny(i);
  const role = i.customId === 'gn_role' ? i.values[0] : null;
  const d = st.get(i.guildId);
  const old = d.gnews;
  // 流し先を変えたら前の投稿は消す
  if (old?.ch && old.ch !== i.channelId) {
    const oc = i.guild.channels.cache.get(old.ch);
    for (const p of Object.values(old.posts || {})) await oc?.messages.delete(p.msg).catch(() => null);
  }
  d.gnews = { ch: i.channelId, role, seen: old?.ch === i.channelId ? old.seen : [], posts: old?.ch === i.channelId ? old.posts : {} };
  await i.update({ embeds: [box(`✅ このチャンネルにお知らせを流すよ。${role ? `\nメンション：<@&${role}>` : '\nメンションはしないよ。'}\n開催中のものをまとめて流すね。${st.warn(i.guild)}`)], components: [] });
  await run(i.guild, await fetchAll());
}

module.exports = { set, pick, tick, parse, embed, run, lines };
