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

  // ゲスト情報 3行までは今まで通り、4組以上は詰める
  const guests = data.guests || [];
  const n = guests.length;
  const lineStartY = Math.round(height * (n > 3 ? 0.47 : 0.50));
  const lineGap = n > 3 ? Math.round(height * 0.22 / (n - 1)) : Math.round(height * 0.10);
  const fs = n > 3 ? Math.round(height * 0.055 * Math.max(0.5, 3 / n)) : Math.round(height * 0.055);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#222222';

  const offset = n === 1 ? lineGap : 0;
  guests.forEach((g, i) => {
    const y = lineStartY + offset + i * lineGap;
    ctx.font = `300 ${fs}px "${THIN}"`;
    ctx.fillText(`${toFullWidthTime(g.time)}　　${g.name}`, cx, y);
  });

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
