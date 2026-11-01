/* =========================================================
 * 🎮 全局游戏手感：震屏 / 白屏闪光 / 大字反馈（借鉴 DuckHunt-JS 等开源实现）
 * ========================================================= */
let shakeV = 0, shakeM = 0;   // 震屏剩余时间 / 震幅
let flashV = 0;               // 白屏闪光剩余时间
let bigFeed = null;           // 大字反馈 {str, sub, t, color}

function addShake(mag, dur) { shakeM = Math.max(shakeM, mag); shakeV = Math.max(shakeV, dur); }
function addFlash(dur) { flashV = Math.max(flashV, dur); }
function showBig(str, color = PIX.yellow, sub = '') { bigFeed = { str, sub, t: 0, color }; }
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

function stepFeel(dt) {
  if (shakeV > 0) shakeV -= dt;
  if (flashV > 0) flashV -= dt;
  if (bigFeed) { bigFeed.t += dt; if (bigFeed.t > 1.5) bigFeed = null; }
}

function drawFeel() {
  if (flashV > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, flashV / 0.05) * 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, -8, view.W + 16, view.H + 16);
    ctx.restore();
  }
  if (!bigFeed) return;
  const k = bigFeed.t < 0.26 ? easeOutBack(bigFeed.t / 0.26) : 1;
  const alpha = bigFeed.t > 1.05 ? Math.max(0, 1 - (bigFeed.t - 1.05) / 0.45) : 1;
  const bounce = bigFeed.t > 1.05 ? Math.sin((bigFeed.t - 1.05) * 30) * 1.5 : 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(view.W / 2, view.H * 0.38 + bounce);
  ctx.scale(k, k);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = pxFont(20, 900);
  ctx.lineWidth = 5; ctx.strokeStyle = PIX.ink; ctx.lineJoin = 'round';
  ctx.strokeText(bigFeed.str, 0, 0);
  ctx.fillStyle = bigFeed.color;
  ctx.fillText(bigFeed.str, 0, 0);
  if (bigFeed.sub) {
    ctx.font = pxFont(8, 700);
    ctx.lineWidth = 3;
    ctx.strokeText(bigFeed.sub, 0, 17);
    ctx.fillStyle = PIX.cream;
    ctx.fillText(bigFeed.sub, 0, 17);
  }
  ctx.restore();
}
