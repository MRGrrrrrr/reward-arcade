/* =========================================================
 * 🎣 游戏三：钓鱼
 * idle（钩子摆动）→ dropping → reeling → reveal / idle
 * ========================================================= */
const fishG = {
  phase: 'idle',       // idle | dropping | reeling | busy
  t: 0,
  hookX: 0, hookY: 46,
  fishes: [],
  carry: null,
  bubbles: [],
  ripples: [],
  splashPs: [],        // 甩竿/咬钩水花粒子
  sndT: 0,
};

function splashAt(x, y, n = 8) {
  for (let i = 0; i < n; i++) {
    fishG.splashPs.push({
      x: x + (Math.random() - .5) * 8,
      y,
      vx: (Math.random() - .5) * 70,
      vy: -40 - Math.random() * 70,
      life: .5 + Math.random() * .3,
    });
  }
}

const FISH_COLORS = ['#f9844a', '#4d9de0', '#9b5de5', '#ffd23f', '#59c135', '#f15bb5'];

function resetFish() {
  fishG.phase = 'idle';
  fishG.t = 0;
  fishG.carry = null;
  fishG.ripples = [];
  fishG.splashPs = [];
  fishG.fishes = [];
  const deck = buildDeck();                    // 每条鱼一张奖券
  const n = deck.length;
  const surf = view.H * 0.32;
  for (let i = 0; i < n; i++) {
    const band = i % 3;
    const dir = Math.random() < .5 ? -1 : 1;
    fishG.fishes.push({
      x: 16 + Math.random() * (view.W - 32),
      y: surf + 18 + band * ((view.H - surf - 66) / 2) + Math.random() * 6,
      vx: dir * (11 + Math.random() * 17),
      size: 8,          // 所有鱼一样大，奖券纯随机藏
      imgKey: 'fishM',
      prize: deck[i],
      caught: false,
      wob: Math.random() * 6,
    });
  }
  fishG.hookX = view.W / 2;
  fishG.hookY = 40;
  renderHeader();
}

/* 中奖后不重新布池：钓走的鱼离场，其余鱼保持原位和奖券不变；
   钓空后才换一批新鱼 */
function nextRoundFish() {
  fishG.fishes = fishG.fishes.filter(f => !f.caught);
  if (!fishG.fishes.length) { resetFish(); return; }
  fishG.phase = 'idle';
  fishG.carry = null;
  fishG.hookY = 40;
  renderHeader();
}

function castLine() {
  if (!state.prizes.length) { toast('请先在后台添加奖品 🎁'); return; }
  if (fishG.phase !== 'idle') return;
  if (!armed) { needCoin(); return; }
  armed = false; // 一枚币一竿
  fishG.phase = 'dropping';
  fishG.hookY = 46;
  fishG.ripples.push({ x: fishG.hookX, y: view.H * 0.32, r: 3, life: .8 });
  splashAt(fishG.hookX, view.H * 0.32, 10);
  Sound.sfx.cast();
  Sound.sfx.splash();
  renderHeader();
}

function stepFish(dt) {
  fishG.t += dt;
  const surf = view.H * 0.32;

  fishG.splashPs = fishG.splashPs.filter(p => (p.life -= dt) > 0 && p.y < view.H + 10);
  for (const p of fishG.splashPs) { p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }

  fishG.bubbles = fishG.bubbles.filter(b => (b.life -= dt) > 0 && b.y > surf);
  for (const b of fishG.bubbles) { b.y -= 16 * dt; b.x += Math.sin(fishG.t * 3 + b.w) * 6 * dt; }
  if (Math.random() < dt * 1) {
    fishG.bubbles.push({ x: Math.random() * view.W, y: view.H - 16, r: 1 + Math.random() * 2, life: 3.5, w: Math.random() * 6 });
  }
  fishG.ripples = fishG.ripples.filter(r => (r.life -= dt) > 0);
  for (const r of fishG.ripples) r.r += 34 * dt;

  for (const f of fishG.fishes) {
    if (f.caught) continue;
    f.x += f.vx * dt;
    if (f.x < 10) { f.x = 10; f.vx = Math.abs(f.vx); }
    if (f.x > view.W - 10) { f.x = view.W - 10; f.vx = -Math.abs(f.vx); }
  }

  if (fishG.phase === 'idle') {
    fishG.hookX = view.W / 2 + Math.sin(fishG.t * 1.5) * (view.W * 0.3);
    return;
  }
  if (fishG.phase === 'dropping') {
    fishG.hookY += 165 * dt;
    for (const f of fishG.fishes) {
      if (f.caught) continue;
      if (Math.hypot(fishG.hookX - f.x, fishG.hookY - f.y) < f.size + 5) {
        f.caught = true;
        fishG.carry = f;
        fishG.phase = 'reeling';
        fishG.sndT = 0;
        Sound.sfx.bite();
        splashAt(f.x, surf + 2, 8);
        showBig('咬钩了！', PIX.yellow, '快收线！');
        for (let i = 0; i < 6; i++) {
          fishG.ripples.push({ x: f.x, y: f.y, r: 2, life: .6 });
        }
        return;
      }
    }
    if (fishG.hookY > view.H - 26) {
      fishG.hookY = view.H - 26;
      fishG.phase = 'reeling';
    }
    return;
  }
  if (fishG.phase === 'reeling') {
    fishG.hookY -= 195 * dt;
    fishG.sndT += dt;
    if (fishG.sndT > 0.1) { fishG.sndT = 0; Sound.sfx.reel(); }
    if (fishG.carry) {
      fishG.carry.x = fishG.hookX;
      fishG.carry.y = fishG.hookY + 4;
    }
    if (fishG.hookY <= 44) {
      const got = fishG.carry;
      fishG.carry = null;
      if (got) {
        fishG.phase = 'busy';
        Sound.sfx.splash();
        splashAt(fishG.hookX, surf + 2, 12);
        addShake(1.5, 0.18);
        showBig('中鱼啦！！', PIX.yellow);
        recordWin(got.prize);
        renderPrizeRows(); renderHistory();
        showWinModal(got.prize, nextRoundFish, 500, `钓上来一条鱼！鱼肚子里是——`);
      } else {
        fishG.phase = 'idle';
        Sound.sfx.lose();
        toast('什么都没钓到，换个时机再甩竿！');
        renderHeader();
      }
    }
    return;
  }
}

function drawFish() {
  const { W, H } = view;
  const surf = H * 0.32;

  // 天空
  ctx.fillStyle = PIX.sky;
  ctx.fillRect(0, 0, W, surf);
  // 像素小船
  ctx.fillStyle = PIX.wood;
  ctx.fillRect(6, 14, 24, 6);
  ctx.fillRect(10, 10, 16, 4);
  ctx.fillStyle = PIX.ink;
  ctx.fillRect(6, 19, 24, 1);
  ctx.fillStyle = PIX.paper;
  ctx.fillRect(14, 2, 2, 9); // 桅杆
  ctx.fillStyle = PIX.red;
  ctx.fillRect(16, 3, 7, 5); // 小旗
  // 太阳
  pxCirc(W - 52, 15, 7, PIX.yellow);

  // 水
  ctx.fillStyle = PIX.water;
  ctx.fillRect(0, surf, W, H - surf);
  // 水下光柱（随时间缓慢摆动）
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#d8f0ff';
  for (const rx of [30, 78, 130]) {
    const sway = Math.sin(fishG.t * 0.7 + rx) * 6;
    ctx.beginPath();
    ctx.moveTo(rx, surf);
    ctx.lineTo(rx + 16, surf);
    ctx.lineTo(rx + 30 + sway, H - 20);
    ctx.lineTo(rx + 2 + sway, H - 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = PIX.deep;
  ctx.fillRect(0, H - 30, W, 30);
  // 像素波浪线
  ctx.fillStyle = '#7cc4ee';
  for (let x = 0; x < W; x += 8) {
    const y = surf + Math.round(Math.sin(x / 14 + fishG.t * 2.2) * 1.5);
    ctx.fillRect(x, y, 4, 1);
  }
  // 沙地
  ctx.fillStyle = PIX.sand;
  ctx.fillRect(0, H - 12, W, 12);
  ctx.fillStyle = '#d4a94e';
  for (let x = 4; x < W; x += 16) ctx.fillRect(x, H - 10, 3, 2);

  // 水草
  ctx.fillStyle = PIX.dgreen;
  for (const sx of [14, W - 18, 34, W - 40]) {
    const sway = Math.round(Math.sin(fishG.t * 1.6 + sx) * 2);
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(sx + sway + (k % 2), H - 16 - k * 4, 2, 4);
    }
  }
  // 水花粒子
  for (const p of fishG.splashPs) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life * 2.5);
    ctx.fillStyle = '#d8f0ff';
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    ctx.restore();
  }
  // 气泡
  for (const b of fishG.bubbles) {
    ctx.save();
    ctx.globalAlpha = Math.min(.7, b.life);
    ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // 波纹
  for (const r of fishG.ripples) {
    ctx.save();
    ctx.globalAlpha = r.life;
    ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, Math.max(1, r.r * .4), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // 鱼
  fishG.fishes.forEach((f, i) => {
    if (f.caught && fishG.carry !== f) return;
    const carried = fishG.carry === f;
    const wob = Math.sin(fishG.t * 4 + f.wob) * 1.2;
    ctx.save();
    ctx.translate(Math.round(f.x), Math.round(f.y + (carried ? 0 : wob * .4)));
    if (carried) ctx.rotate(Math.sin(fishG.t * 12) * .22);
    const key = carried ? f.imgKey + 'Dead' : f.imgKey;
    const img = IMGS[key] || IMGS[f.imgKey];
    if (img) {
      // 素材鱼头朝左：向右游时翻转
      drawImgCentered(img, 0, 0, f.size * 2.3, f.vx > 0);
    } else {
      const dir = f.vx >= 0;
      const sc = f.size / 6.5;
      ctx.scale(dir ? sc : -sc, sc);
      drawSprite(FISH_MAP, fishPalette(FISH_COLORS[i % FISH_COLORS.length]), -6.5, -3.5);
    }
    ctx.restore();
  });

  // 鱼线（从桅杆到钩）
  ctx.strokeStyle = 'rgba(32,34,58,.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(15, 6);
  const midX = (15 + fishG.hookX) / 2;
  ctx.quadraticCurveTo(midX, Math.max(10, fishG.hookY * .4), fishG.hookX, fishG.hookY - 6);
  ctx.stroke();
  // 浮漂（像素）
  ctx.fillStyle = PIX.red;
  ctx.fillRect(Math.round(fishG.hookX) - 2, Math.round(fishG.hookY) - 9, 4, 4);
  ctx.fillStyle = PIX.paper;
  ctx.fillRect(Math.round(fishG.hookX) - 2, Math.round(fishG.hookY) - 8, 4, 1);
  // 钩
  ctx.strokeStyle = PIX.ink; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(fishG.hookX, fishG.hookY, 3, -Math.PI * .1, Math.PI * 1.1);
  ctx.stroke();

  // 提示
  if (fishG.phase === 'idle') {
    if (!armed) text('🪙 投币后甩竿！', W / 2, surf + 13, 8, '#eaf6ff');
    else text('等钩子摆到鱼上方，点「甩竿」！', W / 2, surf + 13, 7, '#eaf6ff');
  }
}
