const STORAGE_KEY = "fourPicsUrdu.v1";
const HINT_COST = 100;
const STAGE_REWARD = 10;
const HARF_DIR = "assets/haroof keys";
const UI = {
  play: "assets/ui/play.svg",
  coin: "assets/ui/coin.svg",
  hint: "assets/ui/hint.svg",
  shop: "assets/ui/shop.svg",
  home: "assets/ui/home.svg",
  logo: "assets/ui/logo.svg",
  card: "assets/ui/card.svg",
  tap: "assets/ui/tap.wav",
  win: "assets/ui/win.wav",
};

const HARF = [
  "ا", "آ", "ب", "پ", "ت", "ٹ", "ث", "ج", "چ",
  "ح", "خ", "د", "ڈ", "ذ", "ر", "ڑ", "ز", "ژ",
  "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
  "ق", "ک", "گ", "ل", "م", "ن", "ں", "و", "ہ",
  "ھ", "ء", "ئ", "ی", "ے",
];

const PACKS = [
  { pkr: 10, coins: 100 },
  { pkr: 20, coins: 200 },
  { pkr: 50, coins: 500 },
];

const state = {
  data: { stages: [] },
  save: loadSave(),
  stageIndex: 0,
  puzzle: null,
  letters: [],
  slots: [],
  locked: [],
  tiles: [],
  busy: false,
  selectedPack: PACKS[0],
};

const sounds = {
  tap: new Audio(UI.tap),
  win: new Audio(UI.win),
};

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    coins: 0,
    solvedCount: 0,
    solved: {},
    currentStageId: null,
    currentWord: null,
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
}

function encodePath(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function splitLetters(word) {
  const cleaned = word.normalize("NFC").replace(/[\u064B-\u065F\u0670\u200C\u200D]/g, "");
  if (Intl.Segmenter) {
    return Array.from(new Intl.Segmenter("ur", { granularity: "grapheme" }).segment(cleaned)).map(
      (s) => s.segment
    );
  }
  return Array.from(cleaned);
}

function $(id) {
  return document.getElementById(id);
}

function playSound(name) {
  const node = new Audio(sounds[name].src);
  node.volume = name === "tap" ? 0.45 : 0.75;
  node.play().catch(() => {});
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  $(id).classList.add("active");
}

function renderCoins() {
  $("homeCoins").textContent = state.save.coins;
  $("gameCoins").textContent = state.save.coins;
}

function currentStage() {
  return state.data.stages[state.stageIndex] || null;
}

function solvedSet(stageId) {
  return new Set(state.save.solved[stageId] || []);
}

function totalPuzzles() {
  return state.data.stages.reduce((sum, stage) => sum + stage.puzzles.length, 0);
}

function pickPuzzle(stage) {
  const solved = solvedSet(stage.id);
  const remaining = stage.puzzles.filter((p) => !solved.has(p.word));
  if (!remaining.length) return null;
  if (state.save.currentStageId === stage.id && state.save.currentWord) {
    const same = remaining.find((p) => p.word === state.save.currentWord);
    if (same) return same;
  }
  return remaining[Math.floor(Math.random() * remaining.length)];
}

function caughtUpMessage() {
  return "موجودہ تمام تصویریں حل ہو گئیں۔ نیا فولڈر assets/pictures میں رکھیں، پھر دوبارہ کھیلیں۔";
}

function startOrContinue() {
  if (!state.data.stages.length) return;
  let idx = state.data.stages.findIndex((s) => s.id === state.save.currentStageId);
  if (idx < 0) idx = 0;
  for (let i = idx; i < state.data.stages.length; i += 1) {
    const puzzle = pickPuzzle(state.data.stages[i]);
    if (puzzle) {
      state.stageIndex = i;
      openPuzzle(puzzle);
      return;
    }
  }
  showScreen("home");
  $("progressNote").textContent = caughtUpMessage();
}

function makeTiles(letters) {
  const tiles = letters.map((letter, index) => ({ id: `n${index}`, letter, used: false }));
  const extraCount = Math.max(4, 12 - letters.length);
  const foreign = shuffle(HARF.filter((ch) => !letters.includes(ch)));
  const bag = foreign.length ? foreign : shuffle(HARF);
  for (let i = 0; i < extraCount; i += 1) {
    tiles.push({ id: `x${i}`, letter: bag[i % bag.length], used: false });
  }
  return shuffle(tiles);
}

function openPuzzle(puzzle) {
  state.puzzle = puzzle;
  state.letters = splitLetters(puzzle.word);
  state.slots = state.letters.map(() => null);
  state.locked = state.letters.map(() => false);
  state.tiles = makeTiles(state.letters);
  state.busy = false;
  state.save.currentStageId = currentStage().id;
  state.save.currentWord = puzzle.word;
  persist();

  $("stageLabel").textContent = `لیول ${state.save.solvedCount + 1}`;
  renderPhotos(puzzle.images);
  renderBoard();
  renderCoins();
  $("photos").classList.remove("celebrating");
  showScreen("game");
}

function renderPhotos(images) {
  const box = $("photos");
  const shown = images.slice(0, 4);
  box.className = `photos count-${Math.min(shown.length, 4)}`;
  box.innerHTML = shown
    .map((src) => `<div class="photo-frame"><img src="${encodePath(src)}" alt=""></div>`)
    .join("");
}

function renderBoard() {
  const row = $("blanks");
  row.style.setProperty("--n", String(state.letters.length));
  row.classList.remove("wrong", "correct");
  row.innerHTML = "";
  state.letters.forEach((_, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "blank";
    const slot = state.slots[i];
    if (slot) {
      el.textContent = slot.letter;
      el.classList.add("filled");
    }
    if (state.locked[i]) el.classList.add("hinted");
    el.addEventListener("click", () => clearSlot(i));
    row.appendChild(el);
  });

  const tray = $("tray");
  tray.innerHTML = "";
  const mid = Math.ceil(state.tiles.length / 2);
  [state.tiles.slice(0, mid), state.tiles.slice(mid)].forEach((group) => {
    if (!group.length) return;
    const line = document.createElement("div");
    line.className = "key-row";
    group.forEach((tile) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `key${tile.used ? " used" : ""}`;
      btn.disabled = tile.used;
      btn.setAttribute("aria-label", tile.letter);
      btn.innerHTML = `<img src="${encodePath(`${HARF_DIR}/${tile.letter}.png`)}" alt="${tile.letter}">`;
      btn.addEventListener("click", () => placeTile(tile.id));
      line.appendChild(btn);
    });
    tray.appendChild(line);
  });
}

function placeTile(id) {
  if (state.busy) return;
  const tile = state.tiles.find((item) => item.id === id);
  if (!tile || tile.used) return;
  const index = state.slots.findIndex((slot) => !slot);
  if (index < 0) return;
  tile.used = true;
  state.slots[index] = { tileId: id, letter: tile.letter };
  playSound("tap");
  renderBoard();
  maybeSubmit();
}

function returnTile(id) {
  const tile = state.tiles.find((item) => item.id === id);
  if (tile) tile.used = false;
}

function clearSlot(index) {
  if (state.busy || state.locked[index] || !state.slots[index]) return;
  returnTile(state.slots[index].tileId);
  state.slots[index] = null;
  playSound("tap");
  renderBoard();
}

function maybeSubmit() {
  if (state.slots.some((slot) => !slot)) return;
  const guess = state.slots.map((slot) => slot.letter).join("");
  if (guess === state.letters.join("")) {
    onWin();
    return;
  }
  $("blanks").classList.add("wrong");
  setTimeout(() => $("blanks").classList.remove("wrong"), 480);
}

function burst() {
  const fx = $("fx");
  fx.innerHTML = "";
  const colors = ["#ffe56b", "#ffffff", "#7ee0c6", "#ff8eb6", "#8ec5ff", "#ffd27a"];
  for (let i = 0; i < 32; i += 1) {
    const bit = document.createElement("i");
    bit.className = "confetti";
    bit.style.left = `${28 + Math.random() * 44}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty("--x", `${(Math.random() - 0.5) * 280}px`);
    bit.style.setProperty("--y", `${120 + Math.random() * 220}px`);
    bit.style.animationDelay = `${Math.random() * 0.12}s`;
    fx.appendChild(bit);
  }
  setTimeout(() => {
    fx.innerHTML = "";
  }, 1100);
}

function onWin() {
  if (state.busy) return;
  state.busy = true;
  const stage = currentStage();
  const solved = solvedSet(stage.id);
  if (!solved.has(state.puzzle.word)) {
    solved.add(state.puzzle.word);
    state.save.solved[stage.id] = Array.from(solved);
    state.save.solvedCount += 1;
    state.save.coins += STAGE_REWARD;
    persist();
    renderCoins();
  }
  $("blanks").classList.add("correct");
  $("photos").classList.add("celebrating");
  playSound("win");
  burst();
  $("winToast").textContent = `+${STAGE_REWARD}`;
  $("winToast").classList.add("show");
  setTimeout(() => {
    $("winToast").classList.remove("show");
    state.save.currentWord = null;
    persist();
    startOrContinue();
  }, 1700);
}

function useHint() {
  if (state.busy) return;
  if (state.save.coins < HINT_COST) {
    openShop();
    return;
  }
  const open = state.letters
    .map((_, i) => i)
    .filter((i) => !state.locked[i] && (!state.slots[i] || state.slots[i].letter !== state.letters[i]));
  if (!open.length) return;
  const index = open[Math.floor(Math.random() * open.length)];
  if (state.slots[index]) returnTile(state.slots[index].tileId);
  const correct = state.letters[index];
  let tile = state.tiles.find((item) => !item.used && item.letter === correct);
  if (!tile) {
    const other = state.slots.findIndex(
      (slot, i) => i !== index && slot && slot.letter === correct && !state.locked[i]
    );
    if (other >= 0) {
      tile = state.tiles.find((item) => item.id === state.slots[other].tileId);
      state.slots[other] = null;
    }
  }
  if (!tile) {
    tile = { id: `h${index}`, letter: correct, used: false };
    state.tiles.push(tile);
  }
  tile.used = true;
  state.slots[index] = { tileId: tile.id, letter: correct };
  state.locked[index] = true;
  state.save.coins -= HINT_COST;
  persist();
  playSound("tap");
  renderCoins();
  renderBoard();
  maybeSubmit();
}

function openShop() {
  const packs = $("packs");
  packs.innerHTML = PACKS.map(
    (pack, i) =>
      `<button class="pack${i === 0 ? " selected" : ""}" data-i="${i}">${pack.pkr} روپے = ${pack.coins} سکے</button>`
  ).join("");
  state.selectedPack = PACKS[0];
  $("shopModal").classList.add("open");
}

function closeShop() {
  $("shopModal").classList.remove("open");
}

function buyCoins() {
  const number = $("cardNumber").value.replace(/\s/g, "");
  const expiry = $("cardExpiry").value.trim();
  const cvc = $("cardCvc").value.trim();
  if (number.length < 12 || expiry.length < 4 || cvc.length < 3) {
    showNote("کارڈ کی معلومات مکمل لکھیں۔ یہ صرف مقامی ڈیمو ادائیگی ہے۔");
    return;
  }
  state.save.coins += state.selectedPack.coins;
  persist();
  renderCoins();
  $("cardNumber").value = "";
  $("cardExpiry").value = "";
  $("cardCvc").value = "";
  closeShop();
  showNote(`${state.selectedPack.coins} سکے شامل ہو گئے!`);
}

function showNote(text) {
  $("winToast").textContent = text;
  $("winToast").classList.add("show");
  setTimeout(() => $("winToast").classList.remove("show"), 1800);
}

function wireUi() {
  $("logo").src = UI.logo;
  $("playIcon").src = UI.play;
  $("backBtn").querySelector("img").src = UI.home;
  $("hintBtn").querySelector("img").src = UI.hint;
  $("shopBtn").querySelector("img").src = UI.shop;
  $("homeShopBtn").querySelector("img").src = UI.shop;
  document.querySelectorAll(".coin-icon").forEach((img) => {
    img.src = UI.coin;
  });
  $("cardArt").src = UI.card;

  $("playBtn").addEventListener("click", startOrContinue);
  $("backBtn").addEventListener("click", () => {
    showScreen("home");
    refreshHome();
  });
  $("hintBtn").addEventListener("click", useHint);
  $("shopBtn").addEventListener("click", openShop);
  $("homeShopBtn").addEventListener("click", openShop);
  $("closeShop").addEventListener("click", closeShop);
  $("payBtn").addEventListener("click", buyCoins);
  $("packs").addEventListener("click", (event) => {
    const btn = event.target.closest(".pack");
    if (!btn) return;
    state.selectedPack = PACKS[Number(btn.dataset.i)];
    $("packs").querySelectorAll(".pack").forEach((el) => el.classList.remove("selected"));
    btn.classList.add("selected");
  });
}

function refreshHome() {
  const next = state.save.solvedCount + 1;
  const left = totalPuzzles() - state.save.solvedCount;
  $("progressNote").textContent = !state.data.stages.length
    ? "پہلے assets/pictures میں فولڈر شامل کریں"
    : left > 0
      ? `لیول ${next} · سکے ${state.save.coins}`
      : caughtUpMessage();
  renderCoins();
}

async function boot() {
  wireUi();
  const res = await fetch("/game/api/puzzles");
  state.data = await res.json();
  refreshHome();
}

boot().catch((err) => {
  $("progressNote").textContent = "سرور سے پہیلیاں نہیں ملیں۔ python server.py چلائیں۔";
  console.error(err);
});
