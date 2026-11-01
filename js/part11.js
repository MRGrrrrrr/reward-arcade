/* =========================================================
 * 家长后台
 * ========================================================= */
$('#btnParent').onclick = () => {
  Sound.sfx.click();
  if (isAdmin) { openAdmin(); return; }
  showModal(`
    <div class="m-emoji">🔐</div>
    <div class="m-title">家长验证</div>
    <div class="m-desc">请输入家长密码进入后台<br><span style="font-size:12px">（默认密码 1234，进入后可修改）</span></div>
    <input type="password" id="pinInput" placeholder="输入密码" maxlength="12" />
    <div class="m-actions">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="pinOk">进入</button>
    </div>`);
  const input = $('#pinInput');
  input.focus();
  const tryPin = () => {
    if (input.value === state.parentPin) { isAdmin = true; closeModal(); openAdmin(); }
    else { toast('密码不对哦'); Sound.sfx.lose(); input.value = ''; input.focus(); }
  };
  $('#pinOk').onclick = tryPin;
  input.onkeydown = e => { if (e.key === 'Enter') tryPin(); };
};

function openAdmin() {
  $('#adminMask').classList.remove('hidden');
  switchAdminTab('prizes');
}
$('#adminClose').onclick = () => $('#adminMask').classList.add('hidden');
$('#adminMask').addEventListener('click', e => {
  if (e.target.id === 'adminMask') $('#adminMask').classList.add('hidden');
});

document.querySelectorAll('.atab').forEach(t => {
  t.onclick = () => { Sound.sfx.click(); switchAdminTab(t.dataset.atab); };
});
function switchAdminTab(name) {
  document.querySelectorAll('.atab').forEach(t =>
    t.classList.toggle('active', t.dataset.atab === name));
  renderAdmin(name);
}

/* --- 后台各页 --- */
function renderAdmin(tab) {
  const body = $('#adminBody');

  if (tab === 'prizes') {
    body.innerHTML = `
      <div class="a-section-title">🎀 奖品管理（三个游戏共用）</div>
      <div id="aPrizeList"></div>
      <button class="a-add" id="aAddPrize">＋ 添加奖品</button>
      <div class="a-note">三个游戏共用这份奖品清单，抽中<b>不会减少</b>数量。「数量」= 游戏里的目标张数：弹珠机有几张盖牌、飞出来几只鸭、水里有几条鱼（每种奖券按份数各出现一次）。数量越大，钓鱼时对应的鱼也越大、越容易钩中。保存后当前游戏重新布局。</div>`;
    const list = $('#aPrizeList');
    state.prizes.forEach(p => {
      const row = document.createElement('div');
      row.className = 'a-row';
      row.innerHTML = `
        <input style="width:48px" class="p-icon" value="${esc(p.icon)}" maxlength="4">
        <input class="grow p-label" value="${esc(p.label)}">
        <span style="flex:none;font-size:12px">数量</span>
        <input style="width:56px" class="p-stock" type="number" min="0" value="${Math.max(0, p.stock)}">
        <button class="a-del" title="删除">✕</button>`;
      row.querySelector('.p-icon').onchange = e => { p.icon = e.target.value || '🎁'; save(); renderAll(); };
      row.querySelector('.p-label').onchange = e => { p.label = e.target.value.trim() || p.label; save(); renderAll(); };
      row.querySelector('.p-stock').onchange = e => { p.stock = Math.max(0, parseInt(e.target.value) || 0); save(); renderAll(); };
      row.querySelector('.a-del').onclick = async () => {
        if (await confirmModal({ emoji: '🗑️', title: '删除该奖品？', desc: p.label, okText: '删除', danger: true })) {
          state.prizes = state.prizes.filter(x => x.id !== p.id);
          save(); renderAll(); renderAdmin('prizes');
        }
      };
      list.appendChild(row);
    });
    $('#aAddPrize').onclick = () => {
      state.prizes.push({ id: uid(), icon: '🎀', label: '新奖品', stock: 1, total: 1 });
      save(); renderAll(); renderAdmin('prizes');
    };
  }

  if (tab === 'basic') {
    body.innerHTML = `
      <div class="a-section-title">🔐 家长密码</div>
      <div class="a-row"><span style="flex:none">新密码</span><input class="grow" id="aPin" type="text" value="${esc(state.parentPin)}"></div>
      <div class="a-actions"><button class="btn btn-primary" id="aSavePin">保存密码</button></div>
      <div class="a-section-title">🔊 声音</div>
      <div class="a-actions"><button class="btn btn-secondary" id="aMuteToggle">${Sound.muted ? '打开声音 🔊' : '关闭声音 🔇'}</button></div>
      <div class="a-note">背景音乐与音效全部由程序实时合成，无需联网。</div>
      <div class="a-note">🎨 素材致谢：鸭子精灵 Bevouliin《Flappy Duck Sprite Sheets》(OGA-BY · opengameart.org/content/flappy-duck-sprite-sheets)；鱼精灵 Andrew Tidey《Fish Pack》(CC0 · opengameart.org/content/fish-set)。</div>
      <div class="a-note">防止孩子误改奖品设置，建议设置一个她不知道的密码。</div>`;
    $('#aSavePin').onclick = () => {
      state.parentPin = $('#aPin').value.trim() || '1234';
      save(); toast('密码已保存 ✓');
    };
    $('#aMuteToggle').onclick = () => { Sound.toggle(); renderSoundBtn(); renderAdmin('basic'); };
  }

  if (tab === 'data') {
    body.innerHTML = `
      <div class="a-section-title">💾 数据备份与恢复</div>
      <div class="a-actions">
        <button class="btn btn-primary" id="aExport">导出备份</button>
        <button class="btn btn-secondary" id="aImport">导入备份</button>
      </div>
      <input type="file" id="aFile" accept=".json" style="display:none">
      <div class="a-section-title">📖 记录管理</div>
      <div class="a-actions">
        <button class="btn btn-secondary" id="aClearHist">清空中奖记录</button>
      </div>
      <div class="a-section-title">⚠️ 危险操作</div>
      <div class="a-actions">
        <button class="btn btn-danger" id="aReset">重置为初始奖品</button>
      </div>
      <div class="a-note">所有数据只保存在这台设备的浏览器里，换设备或清理浏览器前请先导出备份。</div>`;
    $('#aExport').onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const d = new Date();
      a.href = URL.createObjectURL(blob);
      a.download = `游戏厅备份-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    $('#aImport').onclick = () => $('#aFile').click();
    $('#aFile').onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const data = JSON.parse(rd.result);
          if (!Array.isArray(data.prizes)) throw new Error('bad');
          if (await confirmModal({ emoji: '💾', title: '导入备份？', desc: '当前数据将被备份内容覆盖。', okText: '导入' })) {
            state = Object.assign({}, structuredClone(DEFAULTS), data);
            save(); renderAll(); toast('备份已恢复 ✓');
          }
        } catch { toast('文件格式不正确'); }
      };
      rd.readAsText(f);
    };
    $('#aClearHist').onclick = async () => {
      if (await confirmModal({ emoji: '📖', title: '清空中奖记录？', desc: '只清除记录，不影响奖品设置。', okText: '清空', danger: true })) {
        state.history = [];
        save(); renderAll(); toast('记录已清空');
      }
    };
    $('#aReset').onclick = async () => {
      if (await confirmModal({ emoji: '⚠️', title: '重置全部奖品？', desc: '将恢复初始的 6 种奖品，中奖记录也会清空，不可恢复！', okText: '我确定', danger: true })) {
        const pin = state.parentPin;
        state = structuredClone(DEFAULTS);
        state.parentPin = pin;
        save(); renderAll(); toast('已重置为初始奖品');
      }
    };
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- 启动 ---------- */
function renderAll() {
  renderHeader();
  renderPrizeRows();
  renderHistory();
  GAME_IMPL[active].reset();
  renderHeader();
}
resizeGame();
GAME_ORDER.forEach(g => GAME_IMPL[g].reset());
renderPrizeRows();
renderHistory();
renderHeader();
renderSoundBtn();
requestAnimationFrame(loop);
