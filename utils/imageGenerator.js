const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const path = require('path');

const fontPath = path.join(__dirname, '..', 'fonts', 'Noto_Sans_JP', 'NotoSansJP-VariableFont_wght.ttf');
GlobalFonts.registerFromPath(fontPath, 'NotoSans');

async function generateWelcomeImage(parsed, width = 1920, height = 1080) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  try {
    const bgPath = path.join(__dirname, '..', 'assets', 'welcome_bg.jpg');
    const background = await loadImage(bgPath);
    ctx.drawImage(background, 0, 0, width, height);

    // 💡 画面いっぱいに「不透明度 70%」の白いマスクを重ねて背景をうっすら透かす
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(0, 0, width, height);
  } catch (error) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerX = width / 2;

  // 1. Welcome （少し高めの位置に調整）
  ctx.fillStyle = '#111111';
  ctx.font = '100px "NotoSans"';
  ctx.fillText('Welcome', centerX, 260); // 💡 320 から 260 に上げて少し高くしました

  // 2. 日付
  ctx.fillStyle = '#333333';
  ctx.font = '70px "NotoSans"';
  ctx.fillText(parsed.date, centerX, 440);

  // 3. 時間 と 名前 様
  ctx.fillStyle = '#111111';
  ctx.font = '80px "NotoSans"';
  ctx.fillText(`${parsed.time} ${parsed.name} 様`, centerX, 580);

  // 4. 任意のテキスト（あれば描画）
  if (parsed.extraText) {
    ctx.fillStyle = '#555555';
    ctx.font = '55px "NotoSans"';
    ctx.fillText(parsed.extraText, centerX, 760);
  }

  return canvas.toBuffer('image/jpeg');
}

module.exports = {
  generateWelcomeImage
};
