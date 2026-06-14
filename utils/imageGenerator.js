const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const path = require('path');

// 💡 @napi-rs/canvas用の正しいフォント登録方法（これで絶対に文字化けしません）
const fontPath = path.join(__dirname, '..', 'fonts', 'Noto_Sans_JP', 'NotoSansJP-VariableFont_wght.ttf');
GlobalFonts.registerFromPath(fontPath, 'NotoSans');

async function generateWelcomeImage(parsed, width = 1920, height = 1080) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  try {
    const bgPath = path.join(__dirname, '..', 'assets', 'welcome_bg.jpg');
    const background = await loadImage(bgPath);
    ctx.drawImage(background, 0, 0, width, height);

    // 中央の既存文字エリア（KOMAI HOMEや仕切り線など）を白四角で完全に消去
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(400, 150, 1120, 780);
  } catch (error) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerX = width / 2;

  // 1. Welcome
  ctx.fillStyle = '#111111';
  ctx.font = '100px "NotoSans"';
  ctx.fillText('Welcome', centerX, 320);

  // 2. 日付
  ctx.fillStyle = '#333333';
  ctx.font = '70px "NotoSans"';
  ctx.fillText(parsed.date, centerX, 480);

  // 3. 時間 と 名前 様
  ctx.fillStyle = '#111111';
  ctx.font = '80px "NotoSans"';
  ctx.fillText(`${parsed.time} ${parsed.name} 様`, centerX, 610);

  // 4. 任意のテキスト（あれば描画）
  if (parsed.extraText) {
    ctx.fillStyle = '#555555';
    ctx.font = '55px "NotoSans"';
    ctx.fillText(parsed.extraText, centerX, 780);
  }

  return canvas.toBuffer('image/jpeg');
}

module.exports = {
  generateWelcomeImage
};
