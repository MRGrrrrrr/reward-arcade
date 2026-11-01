/* =========================================================
 * 🎰 游戏一：翻牌弹珠机
 * cover → shuffling → ready → pulling → falling → settled → revealing
 * ========================================================= */
const game = {
  slots: [], pegs: [],
  N: 0, slotW: 0, slotH: 50,
  ball: { x: 0, y: 0, vx: 0, vy: 0, r: 6, active: false, rest: 0 },
  phase: 'cover',
  leverT: 0, flash: -1, won: false,
  sndT: 0,
  trail: [], sparks: [],
};

function layoutPinball() {
  const { W, H } = view;
  game.slotH = Math.max(44, Math.min(62, W * 0.26));
  game.N = game.slots.length;
  game.slotW = game.N > 0 ? W / game.N : W;
  game.pegs = [];
  if (game.N >= 2) {
    const rows = Math.min(game.N + 1, 9);
    const top = 66;
    const bottom = H - game.slotH - 14;
    game.ball.r = Math.max(5, Math.min(8, game.slotW * 0.18));
    const pegR = Math.max(3, game.ball.r * 0.72);
    for (let r = 0; r < rows; r++) {
      const y = top + (bottom - top) * (rows === 1 ? 0 : r / (rows - 1));
      const off = (r % 2 === 0) ? game.slotW / 2 : 0;
      for (let i = 0; i < game.N - 1; i++) {
        const x = off + game.slotW / 2 + i * game.slotW;
        game.pegs.push({ x: Math.min(W - pegR - 2, Math.max(pegR + 2, x)), y, r: pegR });
      }
    }
  } else {
    game.ball.r = 6;
  }
}

function setupBoard() {
  game.won = false;
  game.flash = -1;
  game.N = state.prizes.length;
  if (game.N === 0) {
    game.phase = 'over';
    game.slots = [];
    $('#gameOver').classList.remove('hidden');
    renderHeader();
    return;
  }
  $('#gameOver').classList.add('hidden');
  game.slots = buildDeck().map(prize => ({ prize, front: false, t: 1 }));
  game.phase = 'cover';
  layoutPinball();
  game.ball = { x: view.W / 2, y: 22, vx: 0, vy: 0, r: game.ball.r || 6, active: false, rest: 0 };
  renderHeader();
}

function shuffle() {
  if (game.phase === 'over') { toast('请先在后台添加奖品 🎁'); return; }
  if (game.phase !== 'cover') return;
  game.phase = 'shuffling';
  Sound.sfx.shuffle();
  renderHeader();
  [240, 500, 760].forEach((ms, idx) => setTimeout(() => {
    if (game.phase !== 'shuffling') return;
    const deal = buildDeck();
    game.slots.forEach((s, i) => { s.prize = deal[i % deal.length]; });
    Sound.sfx.deal();
    if (idx === 2) {
      game.phase = 'ready';
      armed = true;
      renderHeader();
      toast('洗好啦！可以发射弹珠啦 🎱');
    }
  }, ms));
}

function pull() {
  if (game.phase === 'over') { toast('请先在后台添加奖品 🎁'); return; }
  if (game.phase === 'cover') { toast('先点「🔀 洗牌」把奖券打乱，再发射弹珠哦！'); return; }
  if (game.phase !== 'ready') return;
  if (!armed) { needCoin(); return; }
  game.phase = 'pulling';
  game.leverT = 0;
  game.sndT = 0;
  renderHeader();
}

function launch() {
  const b = game.ball;
  b.active = true;
  b.x = view.W / 2 + (Math.random() - .5) * 6;
  b.y = 22;
  b.vx = (Math.random() - .5) * 100;
  b.vy = 0;
  game.phase = 'falling';
  game.trail = []; game.sparks = [];
  armed = false; // 一枚币一弹珠
  Sound.sfx.launch();
}

function leverPivot() { return { x: view.W - 15, y: 62 }; }
function leverKnobPos() {
  const p = leverPivot();
  const ang = (215 - game.leverT * 125) * Math.PI / 180;
  const len = 30;
  return { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len };
}

function stepPinball(dt) {
  if (game.phase === 'pulling') {
    game.leverT = Math.min(1, game.leverT + dt / 0.26);
    game.sndT += dt;
    if (game.sndT > 0.05) { game.sndT = 0; Sound.sfx.ratchet(); }
    if (game.leverT >= 1) launch();
    return;
  }
  if (game.phase === 'falling') {
    game.leverT = Math.max(0, game.leverT - dt / 0.7);
  }
  if (game.phase !== 'falling') return;

  const b = game.ball;
  const g = 900;
  const capY = view.H - game.slotH - b.r + 2;
  let pegSnd = false;
  // 球尾迹 + 火花粒子
  game.trail.push({ x: b.x, y: b.y });
  if (game.trail.length > 8) game.trail.shift();
  game.sparks.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; });
  game.sparks = game.sparks.filter(p => p.life > 0);
  for (let s = 0; s < 2; s++) {
    const h = dt / 2;
    if (b.y <= capY) b.vy += g * h;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 560) { b.vx *= 560 / sp; b.vy *= 560 / sp; }
    b.x += b.vx * h;
    b.y += b.vy * h;

    if (b.x < b.r + 2) { b.x = b.r + 2; b.vx = Math.abs(b.vx) * 0.55; }
    if (b.x > view.W - b.r - 2) { b.x = view.W - b.r - 2; b.vx = -Math.abs(b.vx) * 0.55; }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.5; }

    for (const p of game.pegs) {
      const dx = b.x - p.x, dy = b.y - p.y;
      const minD = b.r + p.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        b.x = p.x + nx * minD;
        b.y = p.y + ny * minD;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          const e = 0.45;
          b.vx -= (1 + e) * vn * nx;
          b.vy -= (1 + e) * vn * ny;
          b.vx += (Math.random() - .5) * 50;
          b.vy += (Math.random() - .5) * 20;
          pegSnd = true;
          // 碰撞火花
          for (let k = 0; k < 3; k++) {
            game.sparks.push({
              x: p.x + nx * p.r, y: p.y + ny * p.r,
              vx: nx * 40 + (Math.random() - .5) * 60,
              vy: ny * 40 + (Math.random() - .5) * 60,
              life: 0.2 + Math.random() * 0.1,
            });
          }
        }
      }
    }

    if (b.y > capY) {
      const i = Math.min(game.N - 1, Math.max(0, Math.floor(b.x / game.slotW)));
      const gap = 3;
      const left = i * game.slotW + gap + b.r;
      const right = (i + 1) * game.slotW - gap - b.r;
      b.x = Math.max(left, Math.min(right, b.x));
      b.vy *= 0.86; b.vx *= 0.68;
      const cx = (i + 0.5) * game.slotW;
      b.x += (cx - b.x) * 0.14;
      b.y = Math.min(b.y, view.H - game.slotH * 0.42);
      if (Math.abs(b.vy) < 22) {
        b.vy = 0; b.vx = 0; b.rest += h;
        if (b.rest > 0.18) {
          b.x = cx; b.y = view.H - game.slotH * 0.42;
          addShake(1.5, 0.2);
          game.phase = 'settled';
          game.flash = i;
          settlePinball(i);
          return;
        }
      } else {
        b.rest = 0;
      }
    } else {
      b.rest = 0;
    }
  }
  if (pegSnd) {
    const now = performance.now();
    if (!stepPinball._pegT || now - stepPinball._pegT > 70) {
      Sound.sfx.peg();
      stepPinball._pegT = now;
    }
  }
}

function settlePinball(idx) {
  if (game.won) return;
  game.won = true;
  const slot = game.slots[idx];
  const prize = slot.prize;
  slot.front = true;
  game.phase = 'revealing';
  Sound.sfx.flip();
  recordWin(prize);
  renderPrizeRows(); renderHistory(); renderHeader();
  showWinModal(prize, nextRoundPinball, 700, `弹珠落袋，翻开奖格——`);
}

/* 中奖后不重新发牌：只翻开这一格，其余盖牌保持原位，继续玩；
   全部翻完才换一批新奖券（需重新洗牌） */
function nextRoundPinball() {
  if (game.slots.length && game.slots.every(s => s.front)) { setupBoard(); return; }
  game.won = false;
  game.flash = -1;
  game.phase = 'ready';
  game.ball = { x: view.W / 2, y: 22, vx: 0, vy: 0, r: game.ball.r || 6, active: false, rest: 0 };
  renderHeader();
}

function drawPinball() {
  const { W, H } = view;
  const t = Date.now() / 1000;

  // 机台背景
  ctx.fillStyle = '#241f3d';
  ctx.fillRect(0, 0, W, H);
  // 顶部发射井
  ctx.fillStyle = PIX.ink;
  ctx.fillRect(W / 2 - 14, 2, 28, 24);
  ctx.fillStyle = '#3a3160';
  ctx.fillRect(W / 2 - 11, 4, 22, 20);
  // 星星点缀
  ctx.fillStyle = '#4d4280';
  for (const [sx, sy] of [[16, 40], [W - 30, 30], [30, H * 0.45], [W - 24, H * 0.6], [20, H * 0.72]]) {
    ctx.fillRect(sx, sy, 2, 2);
  }

  // 钉子
  for (const p of game.pegs) {
    pxCirc(p.x, p.y, p.r, PIX.yellow);
    ctx.fillStyle = PIX.ink;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }

  // 奖格
  const sh = game.slotH, gap = 3;
  for (let i = 0; i < game.N; i++) {
    const s = game.slots[i];
    if (!s) continue;
    const target = s.front ? 0 : 1;
    s.t += (target - s.t) * 0.16;
    const cx = (i + 0.5) * game.slotW;
    const cy = H - sh / 2 + 1;
    let jx = 0, jy = 0;
    if (game.phase === 'shuffling') {
      jx = (Math.random() - .5) * 5;
      jy = (Math.random() - .5) * 3;
    }
    const w = Math.max(12, game.slotW - gap), h = sh - 8;
    const sx2 = Math.max(0.1, Math.abs(Math.cos(s.t * Math.PI)));
    const flipW = w * sx2;
    ctx.save();
    ctx.translate(Math.round(cx + jx), Math.round(cy + jy));
    if (s.t < 0.5) {
      // 正面：奖券
      ctx.fillStyle = PIX.paper;
      ctx.fillRect(-flipW / 2, -h / 2, flipW, h);
      ctx.fillStyle = PIX.ink;
      ctx.fillRect(-flipW / 2, -h / 2, flipW, 1);
      ctx.fillRect(-flipW / 2, h / 2 - 1, flipW, 1);
      ctx.fillRect(-flipW / 2, -h / 2, 1, h);
      ctx.fillRect(flipW / 2 - 1, -h / 2, 1, h);
      if (i === game.flash && Math.sin(t * 14) > 0) {
        ctx.fillStyle = 'rgba(255,210,63,.55)';
        ctx.fillRect(-flipW / 2, -h / 2, flipW, h);
      }
      text(s.prize.icon, 0, -h * 0.14, Math.max(8, Math.min(12, game.slotW * .5)), PIX.ink);
      text(shortLabel(s.prize.label), 0, h * 0.26, Math.max(5, Math.min(7, game.slotW * .26)), PIX.ink);
    } else {
      // 背面：像素问号牌
      ctx.fillStyle = PIX.red;
      ctx.fillRect(-flipW / 2, -h / 2, flipW, h);
      ctx.fillStyle = '#b32a3d';
      for (let yy = -h / 2 + 2; yy < h / 2 - 2; yy += 4) {
        ctx.fillRect(-flipW / 2 + 2, yy, Math.max(1, flipW - 4), 1);
      }
      ctx.fillStyle = PIX.ink;
      ctx.fillRect(-flipW / 2, -h / 2, flipW, 1);
      ctx.fillRect(-flipW / 2, h / 2 - 1, flipW, 1);
      ctx.fillRect(-flipW / 2, -h / 2, 1, h);
      ctx.fillRect(flipW / 2 - 1, -h / 2, 1, h);
      text('?', 0, 1, Math.max(9, Math.min(14, game.slotW * .6)), PIX.cream);
    }
    ctx.restore();
  }
  // 格间立柱
  ctx.fillStyle = '#4d4280';
  for (let i = 1; i < game.N; i++) ctx.fillRect(Math.round(i * game.slotW) - 1, H - sh, 2, sh);

  // 拉杆
  const pv = leverPivot();
  const knob = leverKnobPos();
  ctx.strokeStyle = PIX.ink; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(knob.x, knob.y); ctx.stroke();
  ctx.strokeStyle = PIX.purple; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(knob.x, knob.y); ctx.stroke();
  pxCirc(pv.x, pv.y, 4, PIX.purple);
  pxCirc(knob.x, knob.y, 6, PIX.yellow);
  ctx.fillStyle = PIX.cream;
  ctx.fillRect(Math.round(knob.x) - 3, Math.round(knob.y) - 3, 2, 2);
  if (game.phase === 'ready' && Math.sin(t * 5) > -0.3) {
    text('拉!', knob.x - 4, knob.y - 12, 7, PIX.yellow);
  }

  // 火花粒子
  game.sparks.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life * 4);
    ctx.fillStyle = PIX.yellow;
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  });
  ctx.globalAlpha = 1;

  // 弹珠（带渐隐尾迹）
  if (game.phase !== 'over') {
    const b = game.ball;
    game.trail.forEach((p, i) => {
      ctx.globalAlpha = (i + 1) / game.trail.length * 0.25;
      ctx.fillStyle = PIX.cream;
      pxCirc(p.x, p.y, Math.max(1.5, b.r * 0.55));
    });
    ctx.globalAlpha = 1;
    drawSprite(BALL_MAP, BALL_PAL, b.x - 4.5, b.y - 4.5);
  }

  // 未投币提示
  if (!armed && (game.phase === 'cover' || game.phase === 'ready') && Math.sin(Date.now() / 300) > -0.4) {
    text('🪙 投币开始', W / 2, H * 0.42, 9, PIX.yellow);
  }
}
