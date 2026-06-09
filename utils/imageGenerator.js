const { createCanvas, loadImage } = require('@napi-rs/canvas');

const COMPANY_NAME = '- KOMAI HOME -';
const BG_OPACITY = 0.15;
const WELCOME_MESSAGE = 'ご来場お待ちしておりました。\n担当スタッフがすぐにご案内いたします。';

// メッセージから日時と名前を抽出
function parseVisitorMessage(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const tokens = firstLine.split(/\s+/);
  if (tokens.length < 3) return null;

  let dateStr = tokens[0];
  let timeStr = tokens[1];
  let nameStr = tokens.slice(2).join(' ');

  // 全角英数を半角に変換
  dateStr = dateStr.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/／/g, '/');
  timeStr = timeStr.replace(/[：０-９]/g, c => c === '：' ? ':' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

  return {
    date: dateStr,
    time: timeStr,
    name: nameStr,
  };
}

// 案内画像の生成
async function generateWelcomeImage(data, width = 1920, height = 1080) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 背景色の塗りつぶし
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 背景の円装飾
  ctx.fillStyle = `rgba(135, 206, 235, ${BG_OPACITY})`;
  ctx.beginPath();
  ctx.arc(width * 0.1, height * 0.2, 400, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 182, 193, ${BG_OPACITY})`;
  ctx.beginPath();
  ctx.arc(width * 0.9, height * 0.8, 500, 0, Math.PI * 2);
  ctx.fill();

  // 会社名
  ctx.fillStyle = '#333333';
  ctx.font = '900 40px NotoSansJP-Black';
  ctx.textAlign = 'center';
  ctx.fillText(COMPANY_NAME, width / 2, 180);

  // メインメッセージ
  ctx.fillStyle = '#555555';
  ctx.font = '100 36px NotoSansJP-Thin';
  ctx.textAlign = 'center';
  
  const msgLines = WELCOME_MESSAGE.split('\n');
  ctx.fillText(msgLines[0], width / 2, 280);
  ctx.fillText(msgLines[1], width / 2, 340);

  // 日時
  const displayDate = data.date.replace('/', '月') + '日';
  const displayTime = data.time.replace(':', '時') + '分';
  ctx.fillStyle = '#666666';
  ctx.font = '100 48px NotoSansJP-Thin';
  ctx.textAlign = 'center';
  ctx.fillText(`${displayDate}  ${displayTime}`, width / 2, height / 2 - 20);

  // 境界線
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 300, height / 2 + 30);
  ctx.lineTo(width / 2 + 300, height / 2 + 30);
  ctx.stroke();

  // 来客名
  ctx.fillStyle = '#111111';
  ctx.font = '900 96px NotoSansJP-Black';
  ctx.textAlign = 'center';
  ctx.fillText(data.name, width / 2, height / 2 + 180);

  return canvas.toBuffer('image/jpeg');
}

module.exports = {
  parseVisitorMessage,
  generateWelcomeImage,
};