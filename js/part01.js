/* =========================================================
 * 🎮 奖励游戏厅 · FC 像素风三合一（弹珠机 / 打鸭子 / 钓鱼）
 *  - 开局把全部奖券副本铺进游戏目标（牌 / 鸭子 / 鱼）
 *  - Web Audio 全合成音效 + 芯片音乐（无需任何音频素材）
 *  - 逻辑分辨率 192x288，CSS 像素放大
 * 数据存 localStorage，奖品不消耗（份数 = 目标数量）。
 * ========================================================= */
'use strict';

const STORE_KEY = 'lucky-wheel-v1';

/* ---------- 默认数据 ---------- */
const DEFAULTS = {
  parentPin: '1234',
  prizes: [
    { id: 'p1', icon: '🛒', label: '山姆购物券 100 元', stock: 2, total: 2 },
    { id: 'p2', icon: '🛒', label: '山姆购物券 50 元',  stock: 6, total: 6 },
    { id: 'p3', icon: '🍽️', label: '美食券',           stock: 1, total: 1 },
    { id: 'p4', icon: '🌳', label: '户外游玩券',       stock: 1, total: 1 },
    { id: 'p5', icon: '🎬', label: '电影券',           stock: 1, total: 1 },
    { id: 'p6', icon: '🎮', label: '游戏 1 小时券',    stock: 1, total: 1 },
  ],
  history: [], // { t, label, icon, game }
  coins: 0,    // 累计投币数
};

/* ---------- 状态 ---------- */
let state = load();
let isAdmin = false;
let active = 'pinball'; // pinball | duck | fish

/* 离线单文件（file://）环境下 localStorage 可能不可用，退化为内存存档 */
let memStore = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign({}, structuredClone(DEFAULTS), JSON.parse(raw));
  } catch (e) { console.warn('读取存档失败，使用默认数据', e); }
  if (memStore) {
    try { return Object.assign({}, structuredClone(DEFAULTS), JSON.parse(memStore)); } catch (e) {}
  }
  return structuredClone(DEFAULTS);
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    memStore = JSON.stringify(state);
  }
}
const uid = () => Math.random().toString(36).slice(2, 9);
const $ = sel => document.querySelector(sel);
const totalRemaining = () => state.prizes.reduce((s, p) => s + Math.max(0, p.stock), 0);

const fmtTime = ts => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmtDate = ts => {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return '今天';
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

function shortLabel(label) {
  if (label.includes('100')) return '100元';
  if (label.includes('50')) return '50元';
  return label.replace(/券/g, '').replace(/\s/g, '').slice(0, 2) || '奖品';
}

/* 展开奖券副本：每种奖券按份数生成目标，全部一次性入局，再洗牌 */
function buildDeck() {
  let deck = [];
  state.prizes.forEach(p => { for (let i = 0; i < Math.max(0, p.stock); i++) deck.push(p); });
  if (!deck.length) deck = state.prizes.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
