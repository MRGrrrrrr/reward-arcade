/* =========================================================
 * 🏹 游戏五：弓箭（准星随风摆动，点屏幕放箭，奖品随机掉落）
 * ========================================================= */
const archG = {
  phase: 'idle',
  t: 0, arrow: null, timer: 0,
  cx: 132, cy: 112, R: 44,
  hits: [],
};
const RING_W = 8.8;

function resetArch() {
  archG.phase = 'idle';
  archG.t = 0; archG.arrow = null; archG.timer = 12;
  archG.hits = [];
  renderHeader();
}

function startArch() {
  if (!state.prizes.length) { toast('请先在后台添加奖品 🎁'); return; }
  if (archG.phase !== 'idle') return;
  if (!armed) { needCoin(); return; }
  armed = false;
  archG.phase = 'play';
  archG.t = 0; archG.arrow = null; archG.timer = 12;
  Sound.sfx.click();
  renderHeader();
}

function archAim() {
  return {
    x: archG.cx + Math.sin(archG.t * 1.35) * 24 + Math.sin(archG.t * 3.1) * 5,
    y: archG.cy + Math.cos(archG.t * 0.95) * 20,
  };
}

function releaseArch() {
  if (archG.phase !== 'play' || archG.arrow) return;
  const a = archAim();
  archG.arrow = { sx: 16, sy: 252, tx: a.x, ty: a.y, t: 0 };
  Sound.sfx.ratchet();
  renderHeader();
}

function stepArch(dt) {
  if (archG.phase !== 'play') return;
  archG.t += dt;
  if (archG.arrow) {
    archG.arrow.t += dt / 0.35;
    if (archG.arrow.t >= 1) {
      const noise = () => (Math.random() * 2 - 1) * 2.5;
      const hx = archG.arrow.tx + noise(), hy = archG.arrow.ty + noise();
      const dist = Math.hypot(hx - archG.cx, hy - archG.cy);
      const k = Math.max(0, Math.min(4, Math.floor((archG.R - dist) / RING_W)));
      const deck = buildDeck();
      const prize = deck[Math.floor(Math.random() * deck.length)];
      archG.hits.push({ x: hx, y: hy });
      archG.phase = 'done';
      addShake(k === 4 ? 2.5 : 1.2, 0.18);
      showBig(k === 4 ? '靶心！！' : '命中！', k === 4 ? PIX.yellow : PIX.cream,
        k === 4 ? '一箭穿心，太厉害了' : `${['外环', '四环', '三环', '二环', '靶心'][k]}命中`);
      Sound.sfx.thud();
      recordWin(prize);
      renderPrizeRows(); renderHistory();
      showWinModal(prize, resetArch, 450, `${['外环', '四环', '三环', '二环', '靶心'][k]}命中！随机战利品是——`);
    }
    return;
  }
  archG.timer -= dt;
  if (archG.timer <= 0) {
    archG.phase = 'idle'; armed = false;
    Sound.sfx.lose();
    toast('时间到！再投币试试 ⏰');
    renderHeader();
  }
}

function drawArch() {
  const { W, H } = view;
  // 天空和草地
  ctx.fillStyle = PIX.sky2; ctx.fillRect(0, 0, W, H * 0.72);
  ctx.fillStyle = PIX.green; ctx.fillRect(0, H * 0.72, W, H * 0.28);
  ctx.fillStyle = PIX.dgreen; ctx.fillRect(0, H * 0.72, W, 4);
  // 靶架
  ctx.fillStyle = PIX.wood; ctx.fillRect(archG.cx - 3, archG.cy + archG.R - 4, 6, H * 0.72 - archG.cy - archG.R + 8);
  // 靶面五环（外→内：白、黑、蓝、红、金）——奖品不展示，射中即随机掉落
  const ringColors = ['#f2f2f2', PIX.ink, PIX.blue, PIX.red, PIX.yellow];
  for (let k = 0; k < 5; k++) {
    ctx.fillStyle = ringColors[k];
    pxCirc(archG.cx, archG.cy, archG.R - k * RING_W);
  }
  for (let k = 0; k < 5; k++) {
    text(['外', '四', '三', '二', '心'][k], archG.cx, archG.cy + archG.R - k * RING_W - RING_W / 2, 4, k === 1 ? PIX.cream : PIX.ink);
  }
  // 靶顶飘动的小旗
  ctx.fillStyle = PIX.ink; ctx.fillRect(archG.cx, archG.cy - archG.R - 16, 1.5, 16);
  const flagW = 10 + Math.sin(archG.t * 5) * 1.5;
  const flagY = archG.cy - archG.R - 15 + Math.sin(archG.t * 3) * 1;
  ctx.fillStyle = PIX.red;
  ctx.beginPath(); ctx.moveTo(archG.cx + 1.5, flagY); ctx.lineTo(archG.cx + 1.5 + flagW, flagY + 3); ctx.lineTo(archG.cx + 1.5, flagY + 6); ctx.closePath(); ctx.fill();
  // 插在靶上的箭（命中留念）
  archG.hits.forEach(h => {
    const ang = Math.atan2(h.y - 252, h.x - 16);
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(ang);
    ctx.fillStyle = PIX.wood; ctx.fillRect(0, -1, 14, 2);
    ctx.fillStyle = PIX.red; ctx.fillRect(12, -3, 4, 2); ctx.fillRect(12, 1, 4, 2);
    ctx.restore();
  });
  // 弓
  ctx.strokeStyle = PIX.wood; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(16, 252, 14, -Math.PI / 2.4, Math.PI / 2.4); ctx.stroke();
  // 准星
  if (archG.phase === 'play' && !archG.arrow) {
    const a = archAim();
    ctx.strokeStyle = PIX.yellow; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PIX.yellow;
    ctx.fillRect(a.x - 1, a.y - 1, 2, 2);
    ctx.fillRect(a.x - 9, a.y, 4, 1); ctx.fillRect(a.x + 5, a.y, 4, 1);
    ctx.fillRect(a.x, a.y - 9, 1, 4); ctx.fillRect(a.x, a.y + 5, 1, 4);
  }
  // 箭
  if (archG.arrow) {
    const ar = archG.arrow, t = Math.min(1, ar.t);
    const hx = ar.sx + (ar.tx - ar.sx) * t;
    const hy = ar.sy + (ar.ty - ar.sy) * t;
    const ang = Math.atan2(ar.ty - ar.sy, ar.tx - ar.sx);
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(ang);
    ctx.fillStyle = PIX.wood; ctx.fillRect(-14, -1, 20, 2);
    ctx.fillStyle = PIX.ink; ctx.beginPath(); ctx.moveTo(6, -2.5); ctx.lineTo(10, 0); ctx.lineTo(6, 2.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PIX.red; ctx.fillRect(-14, -3, 4, 2); ctx.fillRect(-14, 1, 4, 2);
    ctx.restore();
  } else if (archG.phase === 'play') {
    // 搭在弓上的箭
    ctx.fillStyle = PIX.wood; ctx.fillRect(16, 251, 22, 2);
    ctx.fillStyle = PIX.ink; ctx.beginPath(); ctx.moveTo(38, 249.5); ctx.lineTo(42, 252); ctx.lineTo(38, 254.5); ctx.closePath(); ctx.fill();
  }
  // 提示
  if (archG.phase === 'idle') {
    if (!armed) text('🪙 投币射箭', W / 2, H * 0.85, 9, PIX.ink);
    else text('点「🏹 开始」拉弓！', W / 2, H * 0.85, 8, PIX.ink);
  } else if (archG.phase === 'play' && !archG.arrow) {
    text('稳住呼吸，点屏幕放箭！', W / 2, H * 0.85, 8, PIX.ink);
  }
}
