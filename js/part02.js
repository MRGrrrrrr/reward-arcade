/* =========================================================
 * 🔊 音频引擎：Web Audio 全合成（8-bit 芯片风）
 * ========================================================= */
const Sound = (() => {
  let ac = null, master, musicGain, sfxGain;
  let muted = false;
  try { muted = localStorage.getItem('arcade-muted') === '1'; } catch (e) {}
  let musicTimer = null, musicOn = false;

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ac.destination);
      sfxGain = ac.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
      musicGain = ac.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
      return true;
    } catch { return false; }
  }

  function tone({ f = 440, f1 = 0, t = 0, dur = 0.12, type = 'square', vol = 0.16, dest = null }) {
    if (!ensure()) return;
    const now = ac.currentTime + t;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), now);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(now); o.stop(now + dur + 0.05);
  }

  let noiseBuf = null;
  function noise({ t = 0, dur = 0.2, vol = 0.2, f = 1000, f1 = 0, q = 1.2, type = 'lowpass' }) {
    if (!ensure()) return;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const now = ac.currentTime + t;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, now);
    if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(fl); fl.connect(g); g.connect(sfxGain);
    src.start(now); src.stop(now + dur + 0.05);
  }

  /* 背景音乐：C–Am–F–G 活泼芯片循环（方波旋律 + 三角波贝斯 + 噪声镲） */
  const MEL = [
    72, 0, 76, 0, 79, 0, 76, 0, 81, 0, 79, 0, 76, 0, 74, 0,
    72, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0,
  ];
  const BASS = [48, 45, 41, 43]; // C3 Am F2 G2
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const STEP = 60 / 150 / 2; // 150bpm 八分音符
  let step = 0, nextT = 0;

  function schedule() {
    if (!ac) return;
    while (nextT < ac.currentTime + 0.16) {
      const m = MEL[step % MEL.length];
      if (m) {
        tone({ f: mf(m), t: nextT - ac.currentTime, dur: STEP * 0.92, type: 'square', vol: 0.42, dest: musicGain });
      }
      if (step % 8 === 0) {
        const b = BASS[((step / 8) | 0) % BASS.length];
        tone({ f: mf(b), t: nextT - ac.currentTime, dur: STEP * 7.4, type: 'triangle', vol: 0.85, dest: musicGain });
      }
      if (step % 2 === 1) {
        noise({ t: nextT - ac.currentTime, dur: 0.03, vol: 0.05, f: 7000, type: 'highpass' });
      }
      nextT += STEP; step++;
    }
  }
  function startMusic() {
    if (!ensure() || musicOn) return;
    musicOn = true;
    step = 0; nextT = ac.currentTime + 0.08;
    musicTimer = setInterval(schedule, 42);
  }

  const sfx = {
    click()   { tone({ f: 880, f1: 660, dur: 0.06, vol: 0.1 }); },
    shuffle() { [660, 770, 880, 990].forEach((f, i) => tone({ f, t: i * 0.06, dur: 0.06, vol: 0.11 })); },
    deal()    { tone({ f: 1150 + Math.random() * 250, dur: 0.03, type: 'triangle', vol: 0.07 }); },
    ratchet() { noise({ dur: 0.03, vol: 0.1, f: 2600, type: 'highpass' }); },
    launch()  { tone({ f: 170, f1: 760, dur: 0.2, type: 'sine', vol: 0.24 }); noise({ dur: 0.06, vol: 0.12, f: 2200, type: 'highpass' }); },
    peg()     { tone({ f: 1100 + Math.random() * 350, dur: 0.035, type: 'triangle', vol: 0.07 }); },
    flip()    { noise({ dur: 0.09, vol: 0.14, f: 900, f1: 2600, q: 2, type: 'bandpass' }); tone({ f: 700, t: 0.08, dur: 0.09, vol: 0.12 }); },
    quack()   { for (let i = 0; i < 2; i++) { const t = i * 0.15; tone({ f: 430, f1: 220, t, dur: 0.12, type: 'sawtooth', vol: 0.14 }); noise({ t, dur: 0.11, vol: 0.09, f: 900, q: 3, type: 'bandpass' }); } },
    duckFall(){ tone({ f: 420, f1: 130, dur: 0.35, type: 'sawtooth', vol: 0.13 }); },
    hit()     { noise({ dur: 0.12, vol: 0.2, f: 1800, type: 'highpass' }); tone({ f: 320, f1: 110, dur: 0.16, vol: 0.18 }); },
    thud()    { tone({ f: 150, f1: 60, dur: 0.15, type: 'sine', vol: 0.26 }); },
    splash()  { noise({ dur: 0.34, vol: 0.22, f: 1500, f1: 260 }); tone({ f: 500, f1: 100, dur: 0.28, type: 'sine', vol: 0.13 }); },
    cast()    { noise({ dur: 0.13, vol: 0.13, f: 2400, f1: 500 }); },
    bite()    { noise({ dur: 0.18, vol: 0.2, f: 1300, f1: 320 }); tone({ f: 620, f1: 980, dur: 0.12, vol: 0.14 }); },
    reel()    { tone({ f: 950, dur: 0.03, type: 'triangle', vol: 0.055 }); },
    pop()     { tone({ f: 300, f1: 640, dur: 0.08, vol: 0.13 }); },
    bang()    { noise({ dur: 0.09, vol: 0.26, f: 3200, type: 'highpass' }); tone({ f: 220, f1: 55, dur: 0.13, type: 'square', vol: 0.2 }); },
    coin()    { tone({ f: 988, f1: 1319, dur: 0.1, type: 'sine', vol: 0.2 }); tone({ f: 1568, t: 0.09, dur: 0.16, type: 'sine', vol: 0.18 }); noise({ t: 0.02, dur: 0.05, vol: 0.15, f: 1800, type: 'highpass' }); },
    win()     { [523, 659, 784, 1047].forEach((f, i) => { tone({ f, t: i * 0.09, dur: 0.18, vol: 0.15 }); tone({ f: f / 2, t: i * 0.09, dur: 0.18, type: 'triangle', vol: 0.1 }); }); },
    lose()    { [392, 330, 262].forEach((f, i) => tone({ f, t: i * 0.12, dur: 0.15, type: 'triangle', vol: 0.14 })); },
  };

  function toggle() {
    muted = !muted;
    try { localStorage.setItem('arcade-muted', muted ? '1' : '0'); } catch (e) {}
    if (ensure()) master.gain.value = muted ? 0 : 1;
    return muted;
  }

  return { sfx, startMusic, toggle, get muted() { return muted; }, ensure };
})();

/* 首次任意交互启动音频 */
function audioKick() { Sound.ensure(); Sound.startMusic(); }
addEventListener('pointerdown', audioKick, { once: false });
addEventListener('keydown', audioKick, { once: false });

/* ---------- 通用：toast / 弹窗 / 撒花 ---------- */
let toastTimer = null;
function toast(msg) {
  const old = document.getElementById('toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

function showModal(html) {
  $('#modalBox').innerHTML = html;
  $('#modalMask').classList.remove('hidden');
}
function closeModal() { $('#modalMask').classList.add('hidden'); }
$('#modalMask').addEventListener('click', e => {
  if (e.target.id === 'modalMask') closeModal();
});

function confirmModal({ emoji = '❓', title, desc, okText = '确定', cancelText = '取消', danger = false }) {
  return new Promise(resolve => {
    showModal(`
      <div class="m-emoji">${emoji}</div>
      <div class="m-title">${title}</div>
      <div class="m-desc">${desc || ''}</div>
      <div class="m-actions">
        <button class="btn btn-secondary" id="mCancel">${cancelText}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="mOk">${okText}</button>
      </div>`);
    $('#mCancel').onclick = () => { closeModal(); resolve(false); };
    $('#mOk').onclick = () => { closeModal(); resolve(true); };
  });
}

/* 撒花动画 */
const confettiCv = $('#confetti');
const cctx = confettiCv.getContext('2d');
let confettiParts = [];
function resizeConfetti() {
  confettiCv.width = innerWidth; confettiCv.height = innerHeight;
}
addEventListener('resize', resizeConfetti); resizeConfetti();

const CONF_COLORS = ['#ffd23f', '#f15bb5', '#4d9de0', '#59c135', '#f9844a', '#9b5de5'];
function burst(count = 130) {
  for (let i = 0; i < count; i++) {
    confettiParts.push({
      x: innerWidth / 2 + (Math.random() - .5) * 160,
      y: innerHeight * .35,
      vx: (Math.random() - .5) * 11,
      vy: Math.random() * -9 - 3,
      size: 5 + Math.random() * 7,
      color: CONF_COLORS[i % CONF_COLORS.length],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - .5) * .3,
      life: 90 + Math.random() * 50,
    });
  }
  if (!confettiParts._run) { confettiParts._run = true; tickConfetti(); }
}
function tickConfetti() {
  cctx.clearRect(0, 0, confettiCv.width, confettiCv.height);
  confettiParts = confettiParts.filter(p => p.life-- > 0 && p.y < innerHeight + 30);
  for (const p of confettiParts) {
    p.vy += .25; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    cctx.save();
    cctx.translate(p.x, p.y); cctx.rotate(p.rot);
    cctx.fillStyle = p.color; cctx.globalAlpha = Math.min(1, p.life / 40);
    cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .6);
    cctx.restore();
  }
  if (confettiParts.length) requestAnimationFrame(tickConfetti);
  else confettiParts._run = false;
}

/* ---------- 通用：中奖结算 ---------- */
const GAME_NAMES = { pinball: '🎱 弹珠机', duck: '🦆 打鸭子', fish: '🎣 钓鱼', soccer: '⚽ 足球射门', archery: '🏹 弓箭射击' };
const GAME_ORDER = ['pinball', 'duck', 'fish', 'soccer', 'archery'];

function recordWin(prize) {
  state.history.unshift({ t: Date.now(), label: prize.label, icon: prize.icon, game: GAME_NAMES[active] });
  save();
}

function showWinModal(prize, onClose, delay = 500, revealText = '') {
  setTimeout(() => {
    Sound.sfx.win();
    burst(150);
    showModal(`
      <div class="m-emoji">${prize.icon}</div>
      <div class="m-title">🎉 中奖啦！</div>
      <div class="m-desc">${revealText}获得了「<b>${prize.label}</b>」！<br>请找爸爸妈妈领取奖品吧～</div>
      <div class="m-actions"><button class="btn btn-primary" id="mNext">收下奖品</button></div>`);
    $('#mNext').onclick = () => { closeModal(); onClose(); };
  }, delay);
}
