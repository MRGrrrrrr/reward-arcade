/* =========================================================
 * 🪙 投币机制：每局前必须投币；投币后随机三选一自动开局
 * ========================================================= */
const coinFx = { active: false, t: 0, dealt: false };
let armed = false; // 本局已投币（每玩一次都需要投币）

function insertCoin() {
  if (!state.prizes.length) { toast('请先在后台添加奖品 🎁'); return; }
  if (coinFx.active) return;
  Sound.sfx.coin();
  state.coins = (state.coins || 0) + 1;
  save();
  coinFx.active = true; coinFx.t = 0; coinFx.dealt = false;
  renderHeader();
}

function needCoin() {
  toast('先投币哦 🪙');
  Sound.sfx.lose();
}

function stepCoinFx(dt) {
  if (!coinFx.active) return;
  coinFx.t += dt;
  if (!coinFx.dealt && coinFx.t > 0.55) {
    coinFx.dealt = true;
    // 随机八选一，自动切换并开局
    const pick = GAME_ORDER[Math.floor(Math.random() * GAME_ORDER.length)];
    switchGame(pick); // 会先把 armed 置为 false
    armed = true;     // 必须先授权，再开局（各游戏内部有 armed 闸门）
    GAME_IMPL[pick].coinStart();
    toast(`🪙 投币成功！本轮玩「${GAME_NAMES[pick].replace(/^[^\s]+\s/, '')}」`);
    renderHeader();
  }
  if (coinFx.t > 1.1) coinFx.active = false;
}

/* 右上角像素投币口（点击这里也可以投币） */
function drawCoinSlot() {
  const x = view.W - 22, y = 3;
  ctx.fillStyle = PIX.ink;
  ctx.fillRect(x, y, 18, 11);
  ctx.fillStyle = '#4d4280';
  ctx.fillRect(x + 2, y + 2, 14, 7);
  ctx.fillStyle = PIX.yellow;
  ctx.fillRect(x + 5, y + 4, 8, 3);
  ctx.fillStyle = PIX.ink;
  ctx.fillRect(x + 7, y + 4, 4, 3);
  if (Math.sin(Date.now() / 280) > 0) {
    text('COIN', x + 9, y + 17, 5, PIX.yellow);
  }
}

function drawCoinAnim() {
  const k = Math.min(1, coinFx.t / 0.55);
  const sx = view.W / 2, sy = -8;
  const tx = view.W - 13, ty = 8;
  const x = sx + (tx - sx) * k;
  const y = sy + (ty - sy) * (k * k);
  const r = 4.5 - k * 2.5;
  pxCirc(x, y, Math.max(1.5, r), PIX.yellow);
  pxCirc(x, y, Math.max(1, r - 1.2), '#e9b90f');
  if (coinFx.t > 0.55 && Math.sin(coinFx.t * 40) > 0) {
    ctx.fillStyle = PIX.cream;
    ctx.fillRect(view.W - 14, 2, 2, 2);
    ctx.fillRect(view.W - 9, 0, 2, 2);
  }
}

function inCoinSlot(x, y) { return x > view.W - 30 && y < 24; }


/* 五款游戏注册表：reset/step/draw 由 loop 调度；play 是主按钮；coinStart 是投币后自动开局 */
const GAME_IMPL = {
  pinball: { reset: setupBoard, step: stepPinball, draw: drawPinball,
    play: () => { game.phase === 'cover' ? (armed ? shuffle() : needCoin()) : pull(); },
    coinStart: () => { setupBoard(); shuffle(); } },
  duck: { reset: resetDuck, step: stepDuck, draw: drawDuck, play: releaseDucks,
    coinStart: () => { resetDuck(); releaseDucks(); } },
  fish: { reset: resetFish, step: stepFish, draw: drawFish, play: castLine,
    coinStart: () => { resetFish(); } },
  soccer: { reset: resetSoccer, step: stepSoccer, draw: drawSoccer, play: startSoccer,
    coinStart: () => { resetSoccer(); startSoccer(); } },
  archery: { reset: resetArch, step: stepArch, draw: drawArch, play: startArch,
    coinStart: () => { resetArch(); startArch(); } },
};

let lastTs = 0;
function loop(ts) {
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  stepCoinFx(dt);
  stepFeel(dt);
  GAME_IMPL[active].step(dt);

  ctx.clearRect(0, 0, view.W, view.H);
  ctx.save();
  if (shakeV > 0) {
    const k = Math.min(1, shakeV * 5);
    ctx.translate((Math.random() * 2 - 1) * shakeM * k, (Math.random() * 2 - 1) * shakeM * k);
  }
  GAME_IMPL[active].draw();
  drawCoinSlot();
  if (coinFx.active) drawCoinAnim();
  ctx.restore();
  drawFeel();
  requestAnimationFrame(loop);
}

cv.addEventListener('pointerdown', e => {
  const rect = cv.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * view.W;
  const y = (e.clientY - rect.top) / rect.height * view.H;
  if (inCoinSlot(x, y)) { insertCoin(); return; }
  if (active === 'soccer') { kickSoccer(); return; }
  if (active === 'archery') { releaseArch(); return; }
  if (active === 'pinball') {
    const k = leverKnobPos();
    if (Math.hypot(x - k.x, y - k.y) < 26) pull();
  } else if (active === 'duck') {
    if (duck.phase !== 'flying') return;
    if (duck.ducks.some(d => d.falling)) return; // 一枪一中
    Sound.sfx.bang();
    let best = null, bestD = 18;
    for (const d of duck.ducks) {
      if (d.falling || d.fallen) continue;
      if (duck.roundT < d.born) continue;
      const dist = Math.hypot(x - d.x, y - d.y);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    if (best) {
      hitDuck(best);
    } else {
      duck.rings.push({ x, y, r: 4, life: .3 });
      Sound.sfx.click();
    }
  }
});
cv.addEventListener('pointermove', e => {
  if (active !== 'duck') return;
  const rect = cv.getBoundingClientRect();
  duck.aim.x = (e.clientX - rect.left) / rect.width * view.W;
  duck.aim.y = (e.clientY - rect.top) / rect.height * view.H;
});

$('#btnPull').onclick = () => {
  Sound.sfx.click();
  GAME_IMPL[active].play();
};
$('#btnCoin').onclick = insertCoin;

document.querySelectorAll('.gtab').forEach(b => {
  b.onclick = () => { Sound.sfx.click(); switchGame(b.dataset.game); };
});
function switchGame(name) {
  if (active === name) return;
  active = name;
  armed = false; // 投币绑定所选游戏，切页作废
  document.querySelectorAll('.gtab').forEach(t => t.classList.toggle('active', t.dataset.game === name));
  GAME_IMPL[name].reset();
  renderHeader();
}

/* 声音开关 */
function renderSoundBtn() {
  $('#btnSound').textContent = Sound.muted ? '🔇' : '🔊';
}
$('#btnSound').onclick = () => { Sound.toggle(); renderSoundBtn(); Sound.sfx.click(); };

/* ---------- 渲染：头部 ---------- */
function renderHeader() {
  const remain = totalRemaining();
  $('#remainVal').textContent = remain;
  $('#drawCount').textContent = `已玩 ${state.history.length} 次 · 🪙 ${state.coins || 0}`;
  let info = '', label = null;

  if (active === 'pinball') {
    const infoMap = {
      cover: armed ? `🎴 <b>${game.slots.length}</b> 张奖券已盖好 · 点「🔀 洗牌」` : `🪙 投币后随机开游戏 · 洗牌发射弹珠`,
      shuffling: `🔀 洗牌中，马上就好…`,
      ready: armed ? `🎱 发射弹珠！` : `🪙 再投币才能继续玩`,
      pulling: `🎰 发射！`, falling: `🎱 弹珠下落中…`,
      settled: `🎱 落袋！`, revealing: `🎴 翻牌揭晓…`,
      over: `🎉 请先在后台添加奖品`,
    };
    info = infoMap[game.phase] || '';
    label = { cover: armed ? '🔀 洗牌' : '🪙 先投币', shuffling: '洗牌中…', ready: armed ? '🎰 发射弹珠' : '🪙 先投币' }[game.phase];
    $('#gameOver').classList.toggle('hidden', game.phase !== 'over');
  } else if (active === 'duck') {
    if (!state.prizes.length) {
      info = '🎉 请先在后台添加奖品';
    } else if (duck.phase === 'idle') {
      info = armed ? `🦆 一群鸭子藏着奖券 · 点「放鸭子」！` : `🪙 投币后随机开游戏 · 一群鸭子藏着奖券`;
      label = armed ? '🦆 放鸭子' : '🪙 先投币';
    } else {
      info = `🔫 快点击打中一只鸭子！<b>${Math.max(0, duck.endTimer).toFixed(0)}</b> 秒后飞走`;
    }
  } else if (active === 'fish') {
    if (!state.prizes.length) {
      info = '🎉 请先在后台添加奖品';
    } else if (fishG.phase === 'idle') {
      info = armed ? `🎣 看准时机甩竿！` : `🪙 投币后随机开游戏 · 池里 ${fishG.fishes.length} 条鱼藏着奖券`;
      label = armed ? '🎣 甩竿下钩' : '🪙 先投币';
    } else if (fishG.phase === 'dropping') {
      info = '🪝 下钩中…';
    } else if (fishG.phase === 'reeling') {
      info = fishG.carry ? '🐟 中鱼了！收线中…' : '🪝 收线中…';
    } else {
      info = '🐟 鱼出水啦！';
    }
  } else if (active === 'soccer') {
    if (!state.prizes.length) {
      info = '🎉 请先在后台添加奖品';
    } else if (soccerG.phase === 'idle') {
      info = armed ? `⚽ 五个球门格各盖着奖券 · 躲开守门员！` : `🪙 投币后随机开游戏 · 足球射门`;
      label = armed ? '⚽ 开始' : '🪙 先投币';
    } else if (soccerG.phase === 'play' && !soccerG.ball) {
      info = `🥅 瞄准空档，点屏幕射门！<b>${Math.max(0, soccerG.timer).toFixed(0)}</b> 秒`;
    } else if (soccerG.phase === 'play') {
      info = '⚽ 球进了吗…';
    }
  } else if (active === 'archery') {
    if (!state.prizes.length) {
      info = '🎉 请先在后台添加奖品';
    } else if (archG.phase === 'idle') {
      info = armed ? `🏹 射中靶子就随机掉奖品 · 越靠靶心越准！` : `🪙 投币后随机开游戏 · 弓箭射击`;
      label = armed ? '🏹 开始' : '🪙 先投币';
    } else if (archG.phase === 'play' && !archG.arrow) {
      info = `🎯 稳住准星，点屏幕放箭！<b>${Math.max(0, archG.timer).toFixed(0)}</b> 秒`;
    } else if (archG.phase === 'play') {
      info = '🏹 箭在飞…';
    }
  }
  $('#wheelInfo').innerHTML = info;
  $('#btnPull').disabled = !label;
  $('#btnPull').textContent = label || '进行中…';
}

/* ---------- 渲染：奖品清单 ---------- */
function renderPrizeRows() {
  const box = $('#prizeRows');
  if (!box) return; // 主页面板块已移除，后台仍调用
  box.innerHTML = '';
  for (const p of state.prizes) {
    const row = document.createElement('div');
    row.className = 'prize-row';
    row.innerHTML = `
      <span class="pr-icon">${p.icon}</span>
      <span class="pr-label">${esc(p.label)}</span>
      <span class="pr-count">× ${p.stock} 份</span>`;
    box.appendChild(row);
  }
}

/* ---------- 渲染：抽奖记录 ---------- */
function renderHistory() {
  const box = $('#historyList');
  if (!box) return; // 主页面板块已移除，后台仍调用
  if (!state.history.length) {
    box.innerHTML = '<div class="history-empty">还没有中奖记录～<br>任选一个游戏开始吧 🎮</div>';
    return;
  }
  let html = '', lastDay = '';
  for (const h of state.history) {
    const day = fmtDate(h.t);
    if (day !== lastDay) { html += `<div class="history-day">📅 ${day}</div>`; lastDay = day; }
    html += `
      <div class="history-item">
        <span class="hi-icon">${h.icon || '🎁'}</span>
        <span class="hi-text">${esc(h.label)}<span style="color:var(--muted);font-size:11px">　${h.game || ''}</span></span>
        <span style="color:var(--muted);font-size:12px">${fmtTime(h.t)}</span>
      </div>`;
  }
  box.innerHTML = html;
}
