const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// ==============================
// カスタマイズ設定
// ==============================
const COMPANY_NAME = '－ Komai home －';
const WELCOME_MESSAGE = 'ご来社いただきありがとうございます。\n本日はどうぞよろしくお願いいたします。';
const SHOW_MESSAGE = true;
const SHOW_FOOTER = true;

// ==============================
// 全角変換
// ==============================
function toFullWidth(str) {
  return str
    .replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))
    .replace(/:/g, '：');
}

function toFullWidthTime(time) {
  return toFullWidth(time);
}

// ==============================
// メッセージパース（複数行対応）
// 「10/28 13:30 井上」「１０月２８日　１３：３０　井上様」とか。日付なしは今日
// ==============================
function jstToday() {
  const t = new Date(Date.now() + 9 * 3600000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function norm(s) {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[：﹕]/g, ':')
    .replace(/[／]/g, '/')
    .replace(/[－ー−]/g, '-')
    .replace(/[．。]/g, '.')
    .replace(/　/g, ' ');
}

function fixName(n) {
  n = n.replace(/\s+/g, '　').replace(/(さん|様)$/, '').replace(/　$/, '');
  return n + '　様';
}

function parseVisitorMessage(content) {
  const td = jstToday();
  const lines = norm(content).split('\n').map(l => l.trim()).filter(Boolean);
  const re = /^(?:(\d{1,2})\s*(?:[\/.\-]|月)\s*(\d{1,2})\s*日?\s*)?(\d{1,2})\s*(?::|時)\s*(\d{2})\s*分?\s+(.+)$/;

  const guests = [];
  for (const l of lines) {
    const m = l.match(re);
    if (!m) continue;
    const hh = +m[3], mi = +m[4];
    if (hh > 23 || mi > 59) continue;

    let y = td.y, mo = td.m, d = td.d;
    if (m[1]) {
      mo = +m[1]; d = +m[2];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      // 過ぎた日付は来年
      if (mo * 100 + d < td.m * 100 + td.d) y++;
    }

    guests.push({
      date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      time: `${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}`,
      name: fixName(m[5].trim()),
    });
  }

  if (!guests.length) return null;
  return { guests };
}

// ==============================
// 画像生成
// ==============================
async function generateWelcomeImage(data, width = 1920, height = 1080) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const cx = width / 2;
  const THIN = 'NotoSansJP-Thin';

  // 背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Welcomeロゴ画像
  const logoPath = path.join(__dirname, '..', 'assets', 'welcome-logo.png');
  const logo = await loadImage(logoPath);
  const logoW = Math.round(width * 0.75);
  const logoH = Math.round(logoW * (logo.height / logo.width));
  const logoX = cx - logoW / 2;
  const logoY = Math.round(height * 0.08);
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);

  // ゲスト情報 ロゴ下〜挨拶文上の余白の真ん中に置く
  const guests = data.guests || [];
  const n = guests.length;
  const top = logoY + logoH;
  const btm = Math.round(height * 0.80) - Math.round(height * 0.030);
  // 人数多い時は余白に収まるよう行間と文字を縮める
  const gap = Math.min(Math.round(height * 0.10), Math.round((btm - top) * 0.7 / n));
  const fs = Math.min(Math.round(height * 0.055), Math.round(gap * 0.62));
  const mid = (top + btm) / 2;
  const y0 = mid - (gap * (n - 1)) / 2 + fs * 0.35;  // 0.35はベースライン補正

  // 時刻・名前・様の3列でそろえる（様は一番長い名前の後ろ）
  ctx.font = `300 ${fs}px "${THIN}"`;
  ctx.fillStyle = '#222222';
  ctx.textAlign = 'left';
  const ts = guests.map(g => toFullWidthTime(g.time));
  const ns = guests.map(g => g.name.replace(/　様$/, ''));
  const tw = Math.max(...ts.map(t => ctx.measureText(t).width));
  const nw = Math.max(...ns.map(t => ctx.measureText(t).width));
  const sw = ctx.measureText('様').width;
  const sp = fs * 1.2;
  const sp2 = ctx.measureText('　').width;
  const x0 = cx - (tw + sp + nw + sp2 + sw) / 2;

  guests.forEach((g, i) => {
    const y = y0 + i * gap;
    ctx.fillText(ts[i], x0, y);
    ctx.fillText(ns[i], x0 + tw + sp, y);
    ctx.fillText('様', x0 + tw + sp + nw + sp2, y);
  });
  ctx.textAlign = 'center';

  // 下部メッセージ
  if (SHOW_MESSAGE && WELCOME_MESSAGE) {
    const msgY = Math.round(height * 0.80);
    const msgLineH = Math.round(height * 0.045);
    ctx.fillStyle = '#555555';
    ctx.font = `300 ${Math.round(height * 0.030)}px "${THIN}"`;
    WELCOME_MESSAGE.split('\n').forEach((line, i) => {
      ctx.fillText(line, cx, msgY + i * msgLineH);
    });
  }

  // フッター
  if (SHOW_FOOTER && COMPANY_NAME) {
    ctx.fillStyle = '#888888';
    ctx.font = `300 ${Math.round(height * 0.024)}px "${THIN}"`;
    ctx.fillText(COMPANY_NAME, cx, Math.round(height * 0.93));
  }

  return canvas.toBuffer('image/jpeg', { quality: 0.95 });
}

module.exports = {
  jstToday,
  parseVisitorMessage,
  generateWelcomeImage,
};
