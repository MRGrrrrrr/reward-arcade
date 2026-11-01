/* =========================================================
 * ⚽ 游戏四：足球射门（瞄准条往返移动，点屏幕起脚，躲开守门员）
 * ========================================================= */
const soccerG = {
  phase: 'idle',
  aim: 96, dir: 1, ball: null, keeper: -1,
  keeperX: 96, keeperDive: -1, keeperRest: 0,
  kickPs: [],
  prizes: [], timer: 0,
};
const GOAL = { x0: 36, x1: 156, y: 54, slots: 5 };

function resetSoccer() {
  const deck = buildDeck();
  soccerG.prizes = [];
  for (let i = 0; i < GOAL.slots; i++) {
    soccerG.prizes.push(deck[Math.floor(Math.random() * deck.length)]);
  }
  soccerG.phase = 'idle';
  soccerG.aim = 96; soccerG.dir = 1; soccerG.ball = null; soccerG.keeper = -1;
  soccerG.keeperX = 96; soccerG.keeperDive = -1; soccerG.keeperRest = 0;
  soccerG.kickPs = [];
  soccerG.timer = 12;
  renderHeader();
}

function startSoccer() {
  if (!state.prizes.length) { toast('请先在后台添加奖品 🎁'); return; }
  if (soccerG.phase !== 'idle') return;
  if (!armed) { needCoin(); return; }
  armed = false;
  soccerG.phase = 'play';
  soccerG.timer = 12;
  soccerG.keeperRest = 0;
  Sound.sfx.click();
  renderHeader();
}

function kickSoccer() {
  if (soccerG.phase !== 'play' || soccerG.ball) return;
  soccerG.keeper = Math.floor(Math.random() * GOAL.slots);
  const slotW = (GOAL.x1 - GOAL.x0) / GOAL.slots;
  soccerG.keeperDive = GOAL.x0 + slotW * (soccerG.keeper + 0.5); // 扑救目标位置
  soccerG.ball = { sx: 96, sy: 246, tx: soccerG.aim, t: 0 };
  // 踢起草皮粒子
  for (let i = 0; i < 10; i++) {
    soccerG.kickPs.push({
      x: 96 + (Math.random() - .5) * 6, y: 248,
      vx: (Math.random() - .5) * 80,
      vy: -30 - Math.random() * 60,
      life: .4 + Math.random() * .3,
    });
  }
  Sound.sfx.launch();
  renderHeader();
}

function stepSoccer(dt) {
  // 草皮粒子
  soccerG.kickPs = soccerG.kickPs.filter(p => (p.life -= dt) > 0);
  for (const p of soccerG.kickPs) { p.vy += 320 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  // 守门员回中
  if (soccerG.keeperRest > 0) {
    soccerG.keeperRest -= dt;
    soccerG.keeperX += (96 - soccerG.keeperX) * Math.min(1, dt * 6);
  }
  if (soccerG.phase !== 'play') return;
  if (soccerG.ball) {
    soccerG.ball.t += dt / 0.5;
    // 守门员朝预判位置飞身扑救
    if (soccerG.keeperDive >= 0) {
      const kd = soccerG.keeperDive - soccerG.keeperX;
      soccerG.keeperX += Math.sign(kd) * Math.min(Math.abs(kd), 260 * dt);
    }
    if (soccerG.ball.t >= 1) {
      const slotW = (GOAL.x1 - GOAL.x0) / GOAL.slots;
      const slot = Math.max(0, Math.min(GOAL.slots - 1, Math.floor((soccerG.ball.tx - GOAL.x0) / slotW)));
      const prize = soccerG.prizes[slot];
      soccerG.ball = null;
      soccerG.keeperDive = -1;
      soccerG.keeperRest = 1.2;
      if (slot === soccerG.keeper) {
        soccerG.phase = 'idle';
        Sound.sfx.lose();
        addShake(1.5, 0.2);
        showBig('被扑出！', PIX.sky, '守门员神勇扑救');
        toast('被守门员扑出来了！再投币试试 🧤');
        renderHeader();
      } else {
        soccerG.phase = 'done';
        addShake(2.5, 0.3);
        showBig('GOAL！！', PIX.yellow, '球进啦');
        recordWin(prize);
        renderPrizeRows(); renderHistory();
        showWinModal(prize, resetSoccer, 450, '一脚命中！球滚到了——');
      }
    }
    return;
  }
  // 守门员开球前左右巡逻干扰
  soccerG.keeperX = 96 + Math.sin(performance.now() / 1000 * 2.1) * slotW2() * 1.7;
  soccerG.aim += soccerG.dir * 95 * dt;
  if (soccerG.aim > GOAL.x1 - 4) { soccerG.aim = GOAL.x1 - 4; soccerG.dir = -1; }
  if (soccerG.aim < GOAL.x0 + 4) { soccerG.aim = GOAL.x0 + 4; soccerG.dir = 1; }
  soccerG.timer -= dt;
  if (soccerG.timer <= 0) {
    soccerG.phase = 'idle'; armed = false;
    Sound.sfx.lose();
    toast('时间到！再投币试试 ⏰');
    renderHeader();
  }
}
function slotW2() { return (GOAL.x1 - GOAL.x0) / GOAL.slots; }

function drawSoccer() {
  const { W, H } = view;
  // 天空和草地
  ctx.fillStyle = PIX.sky2; ctx.fillRect(0, 0, W, H * 0.5);
  ctx.fillStyle = PIX.green; ctx.fillRect(0, H * 0.5, W, H * 0.5);
  ctx.fillStyle = PIX.dgreen;
  for (let i = 0; i < 6; i++) ctx.fillRect(0, H * 0.5 + i * 15, W, 7);
  const gw = GOAL.x1 - GOAL.x0, slotW = gw / GOAL.slots;
  // 网
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(GOAL.x0, GOAL.y, gw, 42);
  ctx.fillStyle = 'rgba(32,34,58,.28)';
  for (let x = GOAL.x0; x <= GOAL.x1; x += 6) ctx.fillRect(x, GOAL.y, 1, 42);
  for (let y = GOAL.y; y <= GOAL.y + 42; y += 6) ctx.fillRect(GOAL.x0, y, gw, 1);
  // 门柱
  ctx.fillStyle = PIX.cream;
  ctx.fillRect(GOAL.x0 - 3, GOAL.y - 3, 3, 48);
  ctx.fillRect(GOAL.x1, GOAL.y - 3, 3, 48);
  ctx.fillRect(GOAL.x0 - 3, GOAL.y - 3, gw + 6, 3);
  // 每格盖着的奖券（不展示内容，射进哪格随机揭晓）
  soccerG.prizes.forEach((p, i) => {
    const x = GOAL.x0 + slotW * (i + 0.5);
    ctx.fillStyle = PIX.ink; ctx.fillRect(x - 10, GOAL.y + 7, 20, 23);
    ctx.fillStyle = PIX.blue; ctx.fillRect(x - 9, GOAL.y + 8, 18, 21);
    text('?', x, GOAL.y + 19, 11, PIX.cream);
  });
  // 草皮粒子（开脚踢起的草屑）
  soccerG.kickPs.forEach(p => {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.2));
    ctx.fillStyle = p.color || PIX.dgreen;
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  });
  ctx.globalAlpha = 1;
  // 守门员（开脚后扑向预判格，扑救时身体伸展倾斜）
  const kx = soccerG.keeperX;
  const ky = GOAL.y + 36;
  const diving = soccerG.keeperDive >= 0;
  const lean = diving ? Math.max(-0.5, Math.min(0.5, (soccerG.keeperDive - kx) / 40)) : 0;
  ctx.save();
  ctx.translate(kx, ky - 12);
  ctx.rotate(lean);
  ctx.fillStyle = PIX.pink; ctx.fillRect(-4, -6, 8, 9);          // 身体
  ctx.fillStyle = '#f1c27d'; pxCirc(0, -10, 3.5);                // 头
  ctx.fillStyle = PIX.ink;
  ctx.fillRect(-6, 3, 4, 7); ctx.fillRect(2, 3, 4, 7);           // 腿
  ctx.fillStyle = '#f1c27d';
  if (diving) { ctx.fillRect(-11, -8, 7, 3); ctx.fillRect(4, -8, 7, 3); } // 扑救：双臂张开
  else { ctx.fillRect(-8, -5, 3, 6); ctx.fillRect(5, -5, 3, 6); }         // 站立
  ctx.restore();
  // 瞄准标
  if (soccerG.phase === 'play' && !soccerG.ball) {
    const ax = soccerG.aim;
    ctx.fillStyle = PIX.yellow;
    ctx.beginPath(); ctx.moveTo(ax - 5, GOAL.y + 54); ctx.lineTo(ax + 5, GOAL.y + 54); ctx.lineTo(ax, GOAL.y + 45); ctx.closePath(); ctx.fill();
    ctx.fillRect(ax - 1, GOAL.y + 45, 2, 40);
  }
  // 球（飞行 or 点球点）
  if (soccerG.ball) {
    const b = soccerG.ball, t = Math.min(1, b.t);
    const bx = b.sx + (b.tx - b.sx) * t;
    const by = b.sy + (66 - b.sy) * t - Math.sin(Math.PI * t) * 46;
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    pxCirc(b.sx + (b.tx - b.sx) * t, 252, Math.max(2, 6 * (1 - t * 0.6)));
    ctx.fillStyle = PIX.cream; pxCirc(bx, by, 5);
    ctx.fillStyle = PIX.ink;
    ctx.fillRect(bx - 1, by - 4, 2, 2); ctx.fillRect(bx - 3, by + 1, 2, 2); ctx.fillRect(bx + 2, by + 1, 2, 2);
  } else {
    ctx.fillStyle = PIX.cream; pxCirc(96, 246, 5);
    ctx.fillStyle = PIX.ink;
    ctx.fillRect(95, 242, 2, 2); ctx.fillRect(93, 247, 2, 2); ctx.fillRect(97, 247, 2, 2);
    // 罚球的小人
    ctx.fillStyle = PIX.blue; ctx.fillRect(116, 234, 8, 10);
    ctx.fillStyle = '#f1c27d'; pxCirc(120, 230, 3.5);
    ctx.fillStyle = PIX.ink;
    ctx.fillRect(116, 244, 3, 7); ctx.fillRect(121, 244, 3, 7);
  }
  // 提示
  if (soccerG.phase === 'idle') {
    if (!armed) text('🪙 投币踢点球', W / 2, H * 0.45, 9, PIX.ink);
    else text('点「⚽ 开始」踢点球！', W / 2, H * 0.45, 8, PIX.ink);
  } else if (soccerG.phase === 'play' && !soccerG.ball) {
    text('瞄准空档，点屏幕射门！', W / 2, H * 0.45, 8, PIX.ink);
  }
}
