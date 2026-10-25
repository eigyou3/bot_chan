// Enka.Network から原神のプロフィールを取る
const UA = 'bot_chan/1.0 (discord bot)';
const RAW = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/';

const UI = 'https://enka.network/ui/';

let nm = null, nmAt = 0;
let chr = {}, pfp = {}, ja = {};
const cache = new Map();  // uid -> { at, ttl, p, av, raw }

// キャラ名・アイコン・プロフィールアイコンのデータ（1日キャッシュ）
async function names() {
  if (nm && Date.now() - nmAt < 86400000) return nm;
  try {
    const [c, l, pf] = await Promise.all(['characters.json', 'loc.json', 'pfps.json'].map(f => fetch(RAW + f).then(r => r.json())));
    ja = l.ja || {};
    const m = {};
    for (const [id, v] of Object.entries(c)) {
      const n = ja[String(v.NameTextMapHash)];
      if (n) m[id.split('-')[0]] = n;
    }
    nm = m;
    chr = c;
    pfp = pf;
    nmAt = Date.now();
  } catch (e) {
    console.error('キャラデータの取得失敗:', e.message);
  }
  return nm || {};
}

// キャラアイコンのURL（衣装も見る）
function charIcon(a) {
  const c = chr[String(a.avatarId)];
  if (!c) return null;
  const cos = a.costumeId && c.Costumes?.[String(a.costumeId)];
  const ic = cos?.icon || (c.SideIconName || '').replace('_Side_', '_');
  return ic ? `${UI}${ic}.png` : null;
}

// プロフィールアイコンのURL（新しい形式はid、古いのはavatarId）
function pfpIcon(pp) {
  if (!pp) return null;
  if (pp.id && pfp[String(pp.id)]) return `${UI}${pfp[String(pp.id)].iconPath}.png`;
  if (pp.avatarId) return charIcon({ avatarId: pp.avatarId, costumeId: pp.costumeId });
  return null;
}

// 全角数字もOKにしてUIDだけ取り出す
function cleanUid(s) {
  const t = String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\D/g, '');
  return /^\d{9,10}$/.test(t) ? t : null;
}

async function player(uid) {
  const c = cache.get(uid);
  if (c && Date.now() - c.at < c.ttl * 1000) return { p: c.p, av: c.av, raw: c.raw };

  let r;
  try {
    // キャラ詳細（凸）も欲しいので?infoは付けない
    r = await fetch(`https://enka.network/api/uid/${uid}/`, { headers: { 'User-Agent': UA } });
  } catch {
    return { err: 503 };
  }
  if (!r.ok) return { err: r.status };
  const j = await r.json().catch(() => null);
  if (!j?.playerInfo) return { err: 404 };
  // 凸数 = talentIdListの数（詳細非公開の人は無し）
  const av = {};
  for (const a of j.avatarInfoList || []) av[a.avatarId] = (a.talentIdList || []).length;
  const raw = j.avatarInfoList || null;
  cache.set(uid, { at: Date.now(), ttl: j.ttl || 60, p: j.playerInfo, av, raw });
  return { p: j.playerInfo, av, raw };
}

// 日本語テキスト（ステータス名・セット名など）
const loc = k => ja[String(k)] || '';

// キャラのデータ（元素・天賦の並びなど）
const char = id => chr[String(id)] || null;

module.exports = { names, cleanUid, player, charIcon, pfpIcon, loc, char, UI };
