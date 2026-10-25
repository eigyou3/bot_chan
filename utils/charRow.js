const { createCanvas, loadImage } = require('@napi-rs/canvas');

// キャラアイコンを横4つずつ並べた画像を作る
// Discordは横400pxくらいに縮めて表示するので、大きめに作って右を空けとく（くっきり＆小さめに見える）
const W = 150, H = 182, GAP = 12, PER = 4, CW = 900;

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
  const cv = createCanvas(CW, rows * H + (rows - 1) * GAP);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  list.forEach((c, i) => {
    const x = (i % PER) * (W + GAP);
    const y = Math.floor(i / PER) * (H + GAP);

    // 下地
    ctx.fillStyle = '#3a3c43';
    ctx.beginPath();
    ctx.roundRect(x, y, W, H, 16);
    ctx.fill();

    const im = ims[i];
    if (im) ctx.drawImage(im, x + 8, y + 6, W - 16, W - 16);

    ctx.fillStyle = '#e8e8e8';
    ctx.font = '24px "NotoSansJP-Black"';
    ctx.textAlign = 'center';
    // 凸が分かる人だけ C◯ を付ける
    const t = (c.lv ? `Lv.${c.lv}` : '') + (c.c != null ? `  C${c.c}` : '');
    ctx.fillText(t, x + W / 2, y + H - 14);
  });

  return cv.toBuffer('image/png');
}

module.exports = { charRow };
