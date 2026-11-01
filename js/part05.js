/* =========================================================
 * 🦆 游戏二：打鸭子（FC 经典玩法）
 * idle → flying（点中击落）→ reveal
 * ========================================================= */
const duck = {
  phase: 'idle',           // idle | flying
  ducks: [],
  feathers: [],
  rings: [],
  flyAway: false,
  endTimer: 0,
  roundT: 0,
  aim: { x: -100, y: -100 },
};

function resetDuck() {
  duck.phase = 'idle';
  duck.ducks = [];
  duck.feathers = [];
  duck.rings = [];
  duck.flyAway = false;
  duck.endTimer = 0;
  duck.roundT = 0;
  renderHeader();
}

function releaseDucks() {
  if (!state.prizes.length) { toast('请先在后台添加奖品 🎁'); return; }
  if (duck.phase !== 'idle') return;
  if (!armed) { needCoin(); return; }
  duck.phase = 'flying';
  const deck = buildDeck();                    // 全部奖券一次入局
  const n = deck.length;
  const r = n > 8 ? 11 : 15;
  duck.ducks = deck.map((prize, i) => {
    const d0 = {
      x: Wspr(i, n),
      y: view.H - 52,
      tx: 0, ty: 0, txSet: false,
      speed: 46 + Math.random() * 34,
      r,
      prize,
      falling: false,
      fallen: false,
      born: i * 0.14,
      quacked: false,
      rot: 0,
      flap: Math.random() * 6,
      won: false,
      vx: 0, vy: -60,
    };
    newDuckTarget(d0);
    return d0;
  });
  duck.flyAway = false;
  duck.roundT = 0;
  duck.endTimer = 8 + n * 0.6;
  renderHeader();
  toast(`${n} 只鸭子各藏一张奖券，快打中一只！🦆`);
}
function Wspr(i, n) {
  // 出生点横向均匀散开
  return (i + 0.5) / n * (view.W - 40) + 20 + (Math.random() - .5) * 10;
}

/* 借鉴 DuckHunt-JS：鸭子朝随机目标点直线飞，到达后再挑下一个（保持最小飞行距离） */
function newDuckTarget(d) {
  let nx, ny, tries = 0;
  do {
    nx = 18 + Math.random() * (view.W - 36);
    ny = 52 + Math.random() * (view.H - 128);
    tries++;
  } while (tries < 8 && Math.hypot(nx - d.x, ny - d.y) < 56);
  d.tx = nx; d.ty = ny; d.txSet = true;
}

function hitDuck(d) {
  d.falling = true;
  duck.flyAway = true; // 其他鸭子飞走
  duck.endTimer = Math.min(duck.endTimer, 1.8);
  armed = false; // 一枚币一枪
  Sound.sfx.hit();
  Sound.sfx.duckFall();
  addShake(2.2, 0.22);
  addFlash(0.06); // DuckHunt-JS 的开枪白屏闪光
  showBig('砰！！', PIX.yellow);
  for (let i = 0; i < 14; i++) {
    duck.feathers.push({
      x: d.x, y: d.y,
      vx: (Math.random() - .5) * 110,
      vy: -Math.random() * 80,
      rot: Math.random() * Math.PI,
      life: 1.2 + Math.random(),
    });
  }
  duck.rings.push({ x: d.x, y: d.y, r: 5, life: 0.4 });
}

function stepDuck(dt) {
  duck.feathers = duck.feathers.filter(f => (f.life -= dt) > 0);
  for (const f of duck.feathers) {
    f.vy += 130 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 4;
  }
  duck.rings = duck.rings.filter(r => (r.life -= dt) > 0);
  for (const r of duck.rings) r.r += 110 * dt;

  if (duck.phase !== 'flying') return;

  duck.roundT += dt;
  duck.endTimer -= dt;
  if (duck.endTimer <= 0 && !duck.flyAway) {
    duck.flyAway = true;
    Sound.sfx.quack();
    showBig('飞走啦…', PIX.sky, '鸭子们溜掉了');
  }

  let allGone = true;
  for (const d of duck.ducks) {
    if (d.fallen) continue;
    if (duck.roundT < d.born) { allGone = false; continue; } // 还没出场
    if (!d.quacked) { d.quacked = true; if (Math.random() < 0.5) Sound.sfx.quack(); Sound.sfx.pop(); }
    allGone = false;
    if (d.falling) {
      d.vy += 700 * dt;
      d.y += d.vy * dt;
      d.rot += dt * 5;
      if (d.y > view.H - 40 && !d.won) {
        d.won = true;
        d.fallen = true;
        Sound.sfx.thud();
        addShake(1.5, 0.18);
        recordWin(d.prize);
        renderPrizeRows(); renderHistory();
        showWinModal(d.prize, resetDuck, 450, `击中了鸭子！它身上藏着——`);
      }
      continue;
    }
    if (duck.flyAway) {
      // 借鉴 DuckHunt-JS flyAway：成群从屏幕上方逃离
      d.tx = d.x < view.W / 2 ? -70 : view.W + 70;
      d.ty = -70;
    } else if (!d.txSet || Math.hypot(d.tx - d.x, d.ty - d.y) < 12) {
      newDuckTarget(d);
    }
    const dx = d.tx - d.x, dy = d.ty - d.y;
    const dist = Math.hypot(dx, dy) || 1;
    d.vx = dx / dist * d.speed;
    d.vy = dy / dist * d.speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (duck.flyAway && (d.x < -50 || d.x > view.W + 50 || d.y < -50)) {
      d.fallen = true;
    }
  }
  if (duck.flyAway && allGone) {
    duck.phase = 'idle';
    duck.ducks = [];
    armed = false;
    renderHeader();
  }
}

function drawDuck() {
  const { W, H } = view;
  const t = Date.now() / 1000;

  // 天空（像素色带）
  ctx.fillStyle = PIX.sky;
  ctx.fillRect(0, 0, W, H - 44);
  ctx.fillStyle = PIX.sky2;
  ctx.fillRect(0, H - 84, W, 40);
  // 太阳
  pxCirc(20, 24, 9, PIX.yellow);
  ctx.fillStyle = PIX.orange;
  ctx.fillRect(18, 22, 2, 2);
  // 方块云
  ctx.fillStyle = '#fffdf4';
  const clouds = [[(t * 6) % (W + 40) - 20, 18], [(t * 4 + 70) % (W + 40) - 20, 34], [(t * 8 + 130) % (W + 40) - 20, 12]];
  for (const [x, y] of clouds) {
    ctx.fillRect(Math.round(x), y, 18, 4);
    ctx.fillRect(Math.round(x) + 4, y - 3, 10, 3);
    ctx.fillRect(Math.round(x) + 8, y + 4, 10, 3);
  }
  // 远山树丛
  ctx.fillStyle = PIX.dgreen;
  for (let x = 0; x < W; x += 22) {
    ctx.fillRect(x, H - 76, 14, 10);
    ctx.fillRect(x + 4, H - 80, 6, 4);
  }
  // 草地
  ctx.fillStyle = PIX.green;
  ctx.fillRect(0, H - 44, W, 44);
  ctx.fillStyle = PIX.dgreen;
  for (let x = 4; x < W; x += 14) ctx.fillRect(x, H - 46, 3, 3);
  ctx.fillStyle = '#3a7a34';
  ctx.fillRect(0, H - 24, W, 2);

  // 鸭子
  for (const d of duck.ducks) {
    if (d.fallen || duck.roundT < d.born) continue;
    const facing = d.vx >= 0;
    ctx.save();
    ctx.translate(Math.round(d.x), Math.round(d.y));
    if (d.falling) ctx.rotate(d.rot);
    if (d.falling && IMGS.duckHit) {
      drawImgCentered(IMGS.duckHit, 0, 0, d.r * 2.4, !facing);
    } else {
      const flap = Math.sin(t * 10 + d.flap) > 0;
      const img = IMGS[flap ? 'duckFly1' : 'duckFly2'];
      if (img) drawImgCentered(img, 0, 0, d.r * 2.4, !facing);
      else {
        const sc = d.r / 14;
        ctx.scale(facing ? sc : -sc, sc);
        drawSprite(flap ? DUCK_A : DUCK_B, DUCK_PAL, -7, -5);
      }
    }
    ctx.restore();
  }

  // 羽毛
  for (const f of duck.feathers) {
    ctx.save();
    ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = '#fffdf4';
    ctx.fillRect(-2, -1, 4, 2);
    ctx.restore();
  }
  // 命中波纹
  for (const r of duck.rings) {
    ctx.save();
    ctx.globalAlpha = r.life * 2;
    ctx.strokeStyle = PIX.red; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // 准星
  if (duck.phase === 'flying' && duck.aim.x > 0) {
    const { x, y } = duck.aim;
    ctx.save();
    ctx.globalAlpha = .85;
    ctx.strokeStyle = PIX.red; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PIX.red;
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.beginPath();
    ctx.moveTo(x - 11, y); ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y); ctx.lineTo(x + 11, y);
    ctx.moveTo(x, y - 11); ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 11);
    ctx.stroke();
    ctx.restore();
  }
  // 空闲提示
  if (duck.phase === 'idle') {
    if (!armed) {
      text('🪙 投币放鸭子', W / 2, H / 2 - 14, 9, PIX.ink);
    } else {
      text('点下方「放鸭子」！', W / 2, H / 2 - 14, 8, PIX.ink);
    }
    text('🦆', W / 2, H / 2 + 16, 16, PIX.ink);
  }
}
