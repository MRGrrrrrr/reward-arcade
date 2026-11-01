/* =========================================================
 * 画布：固定逻辑分辨率 192x288，CSS 像素放大
 * ========================================================= */
const cv = $('#gameCanvas');
const ctx = cv.getContext('2d');

const view = { W: 192, H: 288, dpr: 1 };

/* FC 像素调色板 */
const PIX = {
  ink: '#20223a', cream: '#fff6dd', paper: '#fffdf4',
  red: '#e73e52', yellow: '#ffd23f', blue: '#4d9de0',
  green: '#59c135', dgreen: '#2f8f3b', purple: '#9b5de5',
  pink: '#f15bb5', orange: '#f9844a',
  sky: '#8ecae6', sky2: '#c8ecf7', water: '#1f6fb4', deep: '#0d3a6b',
  sand: '#e9c46a', wood: '#8a5a3b',
};

const pxFont = (s, w = 700) => `${w} ${s}px "Courier New", ui-monospace, monospace`;
const text = (str, x, y, size = 8, color = PIX.ink, align = 'center', w = 700) => {
  ctx.font = pxFont(size, w);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, Math.round(x), Math.round(y));
};

/* 像素圆 / 像素椭圆：栅格化成 1px 方块 */
function pxCirc(x, y, r, color, rY = null) {
  const ry = rY === null ? r : rY;
  const cx = Math.round(x), cy = Math.round(y);
  const R = Math.ceil(Math.max(r, ry));
  ctx.fillStyle = color;
  for (let gy = -R; gy <= R; gy++) {
    for (let gx = -R; gx <= R; gx++) {
      const nx = gx / (r + 0.35), ny = gy / (ry + 0.35);
      if (nx * nx + ny * ny <= 1) ctx.fillRect(cx + gx, cy + gy, 1, 1);
    }
  }
}
function pxEllipse(x, y, rx, ry, color) { pxCirc(x, y, rx, color, ry); }

/* 像素精灵：字符画 → 像素块。pal: {字符: 颜色} */
function drawSprite(map, pal, x, y, flip = false) {
  const w = map[0].length;
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[flip ? w - 1 - c : c];
      const col = pal[ch];
      if (col) ctx.fillRect(Math.round(x) + c, Math.round(y) + r, 1, 1);
    }
  }
}

/* 像素鸭子（FC 打鸭子风），14x10，两帧翅膀 */
const DUCK_A = [
  '.....KKKKK....',
  '....KGGGGGK...',
  '...KGGGGGGOK..',
  '...KGKGGGGOK..',
  '....KKWWWW....',
  '....KWWBBWW...',
  '.KKKWWBBBBWK..',
  'KWWWWBBBBBWWK.',
  '.KBBBBBBBWWK..',
  '..KKKKKKKKK...',
];
const DUCK_B = [
  '.....KKKKK....',
  '....KGGGGGK...',
  '...KGGGGGGOK..',
  '...KGKGGGGOK..',
  '....KKWWWW....',
  '.KKKWWBBWW....',
  'KWWWWBBBBWWKK.',
  '.KBBBBBBBWWWWK',
  '..KWWWWWWWK...',
  '...KKKKKKK....',
];
const DUCK_PAL = { K: PIX.ink, G: '#2f9e44', W: '#fffdf4', B: '#b07a3f', O: PIX.orange };

/* 像素鱼（朝右），13x7，C=身体色 c=深色 W=眼白 K=瞳/轮廓 O=嘴 */
const FISH_MAP = [
  'K.....KKKK...',
  'KK..KKCCCCOK.',
  'KCKKCCCCCCCK.',
  'KCKCCWCCCCCOK',
  'KCKKCCCCCCCK.',
  'KK..KKCCCCOK.',
  'K.....KKKK...',
];
function fishPalette(color) {
  return { K: PIX.ink, C: color, O: PIX.orange, W: '#fffdf4' };
}

/* 像素扭蛋球（弹珠）12x12 */
const BALL_MAP = [
  '....KKKK....',
  '..KKWWWWKK..',
  '.KWWWWWRWWK.',
  'KWWWWRRRWWK.',
  'KWWWWRRRRWWK',
  'KWWWWRRRWWK.',
  '.KWWWRRRWWK.',
  '..KKRRRRKK..',
  '....KKKK....',
];
const BALL_PAL = { K: PIX.ink, W: '#fff6dd', R: '#ff8fab' };

/* 外部素材（CC0 / OGA-BY，致谢见后台"设置"页；加载失败自动回退到程序生成的像素精灵） */
const IMGS = {};
function loadImg(key, src) {
  const im = new Image();
  im.onload = () => { IMGS[key] = im; };
  im.src = src;
}

/* 图片 base64 分片存储（避免超长行），组装后加载 */
const IMGB64 = window.IMGB64 || {};
Object.keys(IMGB64).forEach(k => loadImg(k, 'data:image/png;base64,' + IMGB64[k].join('')));

function drawImgCentered(img, x, y, w, flip = false, rot = 0) {
  const h = img.height * (w / img.width);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (rot) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return h;
}

function resizeGame() {
  view.W = 192; view.H = 288; view.dpr = 1;
  cv.width = 192; cv.height = 288;
  ctx.imageSmoothingEnabled = false;
  layoutPinball();
}
addEventListener('resize', resizeGame);
