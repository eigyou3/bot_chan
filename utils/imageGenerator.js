const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

const fontPath = path.join(__dirname, '..', 'fonts', 'Noto_Sans_JP', 'NotoSansJP-Bold.ttf');
registerFont(fontPath, { family: 'NotoSans' });

function parseVisitorMessage(content) {
  const dateRegex = /([\d０-９]{1,2})[\/／月]([\d０-９]{1,2})/;
  const timeRegex = /([\d０-９]{1,2})[:：時]([\d０-９]{1,2})/;
  const nameRegex = /([^\s\n]+?)(?:様|さん)/;

  const dateMatch = content.match(dateRegex);
  const timeMatch = content.match(timeRegex);
  const nameMatch = content.match(nameRegex);

  if (!dateMatch || !nameMatch) return null;

  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  let extraText = '';
  
  const filterLines = lines.filter(line => 
    !dateRegex.test(line) && !nameRegex.test(line) && !/ウェルカム|予約/.test(line)
  );
  if (filterLines.length > 0) {
    extraText = filterLines[0];
  }

  return {
    date: `2026/${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}`,
    time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}` : '13:00',
    name: nameMatch[1],
    extraText: extraText
  };
}

async function generateWelcomeImage(parsed, width = 1920, height = 1080) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  try {
    const bgPath = path.join(__dirname, '..', 'assets', 'welcome_bg.jpg');
    const background = await loadImage(bgPath);
    ctx.drawImage(background, 0, 0, width, height);
  } catch (error) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerX = width / 2;

  ctx.fillStyle = '#333333';
  ctx.font = '90px "NotoSans"';
  ctx.fillText('Welcome', centerX, 350);

  ctx.fillStyle = '#444444';
  ctx.font = '65px "NotoSans"';
  ctx.fillText(parsed.date, centerX, 490);

  ctx.fillStyle = '#222222';
  ctx.font = '75px "NotoSans"';
  ctx.fillText(`${parsed.time} ${parsed.name} 様`, centerX, 610);

  if (parsed.extraText) {
    ctx.fillStyle = '#555555';
    ctx.font = '50px "NotoSans"';
    ctx.fillText(parsed.extraText, centerX, 750);
  }

  return canvas.toBuffer('image/jpeg');
}

module.exports = {
  parseVisitorMessage,
  generateWelcomeImage
};
