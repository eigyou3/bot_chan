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
// ==============================
function parseVisitorMessage(content) {
  const normalized = content
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[：]/g, ':')
    .replace(/[　]/g, ' ')
    .trim();

  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const guests = [];
  for (const line of lines.slice(0, 3)) {
    const tokens = line.split(/\s+/);
    if (tokens.length < 2) continue;

    const timeStr = tokens[0];
    let nameStr = tokens.slice(1).join('　');

    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) continue;

    const hour = timeMatch[1].padStart(2, '0');
    const min  = timeMatch[2].padStart(2, '0');

    if (!nameStr.endsWith('様') && !nameStr.endsWith('さん')) {
      nameStr += '　様';
    } else if (nameStr.endsWith('さん')) {
      nameStr = nameStr.replace(/さん$/, '　様');
    } else if (nameStr.endsWith('様') && !nameStr.endsWith('　様')) {
      nameStr = nameStr.replace(/様$/, '　様');
    }

    guests.push({ time: `${hour}:${min}`, name: nameStr });
  }

  if (guests.length === 0) return null;
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

  // ゲスト情報（最大3行）
  const lineStartY = Math.round(height * 0.50);
  const lineGap    = Math.round(height * 0.10);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#222222';

  const guests = data.guests || [];
  const offset = guests.length === 1 ? lineGap : 0;
  guests.forEach((g, i) => {
    const y = lineStartY + offset + i * lineGap;
    const timeStr = toFullWidthTime(g.time);
    const line = `${timeStr}　　${g.name}`;
    ctx.font = `300 ${Math.round(height * 0.055)}px "${THIN}"`;
    ctx.fillText(line, cx, y);
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
  parseVisitorMessage,
  generateWelcomeImage,
};
