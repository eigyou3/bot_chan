const { createCanvas, loadImage } = require('@napi-rs/canvas');

// キャラアイコンを横4つずつ並べた画像を作る
const W = 180, H = 210, GAP = 16, PER = 4;

async function img(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await loadImage(Buffer.from(await r.arrayBuffer()));
  } catch {
    return null;
  }
}

async function charRow(list) {
  const ims = await Promise.all(list.map(c => c.url ? img(c.url) : null));
  const n = list.length;
  const cols = Math.min(PER, n);
  const rows = Math.ceil(n / PER);
  const cv = createCanvas(cols * W + (cols - 1) * GAP, rows * H + (rows - 1) * GAP);
  const ctx = cv.getContext('2d');

  list.forEach((c, i) => {
    const x = (i % PER) * (W + GAP);
    const y = Math.floor(i / PER) * (H + GAP);

    // 下地
    ctx.fillStyle = '#3a3c43';
    ctx.beginPath();
    ctx.roundRect(x, y, W, H, 18);
    ctx.fill();

    const im = ims[i];
    if (im) ctx.drawImage(im, x + 10, y + 6, W - 20, W - 20);

    ctx.fillStyle = '#e8e8e8';
    ctx.font = '26px "NotoSansJP-Black"';
    ctx.textAlign = 'center';
    ctx.fillText(c.lv ? `Lv.${c.lv}` : (c.name || ''), x + W / 2, y + H - 16);
  });

  return cv.toBuffer('image/png');
}

module.exports = { charRow };
