// 토익 단어 암기 PWA
// words.json 형식: [영단어, 품사, 뜻, (사용 안 함)]
// 전체 단어를 Day 1~60(약 20개씩)으로 나눠서 "단어 외우기 → 4지선다 테스트" 순서로 공부한다.

const PART_COUNT = 60;
const QUIZ_MAX = 20;
const POS_KO = {
  n: '명사', v: '동사', adj: '형용사', adv: '부사', phr: '구',
  conj: '접속사', prep: '전치사', 'n/v': '명사/동사', 'adj/n': '형용사/명사', 'v/n': '동사/명사',
};

let WORDS = [];
let PARTS = []; // PARTS[i] = Day i+1 의 단어 배열

// ---------- 저장 ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const store = {
  known: new Set(load('known', [])),
  wrong: new Set(load('wrong', [])),
  best: load('best', {}),          // { dayNumber: 최고 점수(맞힌 개수) }
  lastDay: load('lastDay', null),
  rev: load('reverseQ', false),
  save() {
    localStorage.setItem('known', JSON.stringify([...this.known]));
    localStorage.setItem('wrong', JSON.stringify([...this.wrong]));
    localStorage.setItem('best', JSON.stringify(this.best));
    localStorage.setItem('lastDay', JSON.stringify(this.lastDay));
    localStorage.setItem('reverseQ', JSON.stringify(this.rev));
  },
};

// ---------- 유틸 ----------
const app = document.getElementById('app');
const $ = (sel) => app.querySelector(sel);
const $$ = (sel) => [...app.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const posLabel = (p) => POS_KO[p] || p;
const knownCount = (words) => words.filter((w) => store.known.has(w.en)).length;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const bar = (p) => `<div class="bar"><div style="width:${p}%"></div></div>`;
const header = (backHref, backLabel, title, right = '') =>
  `<header class="top"><a class="back" href="${backHref}">‹ ${esc(backLabel)}</a><span class="title">${esc(title)}</span><span class="right">${right}</span></header>`;

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

// ---------- 라우터 (#/day/3/words 형태) ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if ('speechSynthesis' in window) speechSynthesis.cancel();

  if (parts[0] === 'day') {
    const d = Number(parts[1]);
    if (!(d >= 1 && d <= PARTS.length)) return (location.hash = '#/');
    store.lastDay = d;
    store.save();
    if (parts[2] === 'words') return renderWords(d);
    if (parts[2] === 'quiz') return startQuiz({ words: PARTS[d - 1], day: d });
    return renderDay(d);
  }
  if (parts[0] === 'wrong') {
    if (parts[1] === 'quiz') return startQuiz({ words: wrongWords(), wrongNote: true });
    return renderWrong();
  }
  if (parts[0] === 'search') return renderSearch();
  renderHome();
}
window.addEventListener('hashchange', route);

const wrongWords = () => WORDS.filter((w) => store.wrong.has(w.en));

// ---------- 홈 ----------
function renderHome() {
  const known = knownCount(WORDS);
  const cont = store.lastDay || 1;
  const tiles = PARTS.map((words, i) => {
    const d = i + 1;
    const k = knownCount(words);
    const done = k === words.length;
    const best = store.best[d];
    return `<a class="tile${done ? ' done' : ''}${d === store.lastDay ? ' current' : ''}" href="#/day/${d}">
      <span class="tday">Day ${d}</span>
      <span class="tsub">${done ? '완료 ✓' : `${k}/${words.length}`}</span>
      ${bar(pct(k, words.length))}
      ${best != null ? `<span class="tbest">테스트 ${best}/${words.length}</span>` : ''}
    </a>`;
  }).join('');

  app.innerHTML = `
    <h1>토익 단어</h1>
    <div class="summary">
      <div>외운 단어 <b>${known}</b> / ${WORDS.length} <span class="muted">(${pct(known, WORDS.length)}%)</span></div>
      ${bar(pct(known, WORDS.length))}
    </div>
    <a class="btn primary" href="#/day/${cont}">${store.lastDay ? '이어서 하기' : '시작하기'} · Day ${cont} ›</a>
    <div class="two">
      <a class="btn" href="#/wrong">오답 노트 <b>${store.wrong.size}</b></a>
      <a class="btn" href="#/search">단어 검색</a>
    </div>
    <h2>Day 선택 <span class="muted small">하루 약 20단어</span></h2>
    <div class="grid">${tiles}</div>
    <button class="link danger" id="reset">학습 기록 초기화</button>
  `;
  $('#reset').addEventListener('click', () => {
    if (!confirm('외운 단어, 오답 노트, 테스트 점수를 모두 지울까요?')) return;
    store.known.clear();
    store.wrong.clear();
    store.best = {};
    store.lastDay = null;
    store.save();
    renderHome();
  });
  const cur = $('.tile.current');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
  window.scrollTo(0, 0);
}

// ---------- Day ----------
function renderDay(d) {
  const words = PARTS[d - 1];
  const k = knownCount(words);
  const best = store.best[d];
  app.innerHTML = `
    ${header('#/', '홈', `Day ${d}`)}
    <div class="summary">
      <div>외운 단어 <b>${k}</b> / ${words.length} · 테스트 최고 <b>${best != null ? `${best}/${words.length}` : '–'}</b></div>
      ${bar(pct(k, words.length))}
    </div>
    <a class="step" href="#/day/${d}/words">
      <span class="num">1</span>
      <span><b>단어 외우기</b><small>뜻을 가려두고, 탭해서 확인해요</small></span>
      <span class="chev">›</span>
    </a>
    <a class="step" href="#/day/${d}/quiz">
      <span class="num">2</span>
      <span><b>4지선다 테스트</b><small>${words.length}문제 · 틀린 단어는 오답 노트로</small></span>
      <span class="chev">›</span>
    </a>
    <p class="preview muted small">${words.slice(0, 6).map((w) => esc(w.en)).join(', ')} …</p>
    <div class="two">
      ${d > 1 ? `<a class="btn" href="#/day/${d - 1}">‹ Day ${d - 1}</a>` : '<span></span>'}
      ${d < PARTS.length ? `<a class="btn" href="#/day/${d + 1}">Day ${d + 1} ›</a>` : '<span></span>'}
    </div>
  `;
}

// ---------- 단어 목록 (뜻 가림) ----------
function wordRow(w, { showDay = false, open = false } = {}) {
  const day = showDay ? `<span class="dtag">Day ${w.day}</span>` : '';
  return `<li data-en="${esc(w.en)}">
    <input type="checkbox" class="known" aria-label="외움" ${store.known.has(w.en) ? 'checked' : ''}>
    <div class="txt">
      <div><span class="w">${esc(w.en)}</span><span class="p">${esc(posLabel(w.pos))}</span>${store.wrong.has(w.en) ? '<span class="x">오답</span>' : ''}${day}</div>
      <div class="m${open ? '' : ' covered'}">${esc(w.ko)}</div>
    </div>
  </li>`;
}

function bindWordList(onChange) {
  $$('#wordList li').forEach((li) => {
    const en = li.dataset.en;
    const m = li.querySelector('.m');
    li.querySelector('.txt').addEventListener('click', () => {
      if (!m.classList.toggle('covered')) speak(en);
    });
    li.querySelector('.known').addEventListener('change', (e) => {
      if (e.target.checked) { store.known.add(en); store.wrong.delete(en); }
      else store.known.delete(en);
      store.save();
      onChange && onChange();
    });
  });
}

function renderWords(d) {
  const words = PARTS[d - 1];
  const draw = () => {
    const k = knownCount(words);
    app.innerHTML = `
      ${header(`#/day/${d}`, `Day ${d}`, '단어 외우기', `<button class="mini" id="toggleAll">모두 보기</button>`)}
      <p class="muted small">단어를 탭하면 뜻이 보여요. 외운 단어는 체크하세요. <b id="kc">${k}/${words.length}</b></p>
      <ul id="wordList">${words.map((w) => wordRow(w)).join('')}</ul>
      <a class="btn primary" href="#/day/${d}/quiz">테스트 보러 가기 ›</a>
    `;
    bindWordList(() => { $('#kc').textContent = `${knownCount(words)}/${words.length}`; });
    $('#toggleAll').addEventListener('click', (e) => {
      const ms = $$('#wordList .m');
      const anyCovered = ms.some((m) => m.classList.contains('covered'));
      ms.forEach((m) => m.classList.toggle('covered', !anyCovered));
      e.target.textContent = anyCovered ? '모두 가리기' : '모두 보기';
    });
  };
  draw();
}

// ---------- 오답 노트 ----------
function renderWrong() {
  const words = wrongWords();
  app.innerHTML = `
    ${header('#/', '홈', '오답 노트', `<span class="muted">${words.length}개</span>`)}
    ${words.length
      ? `<a class="btn primary" href="#/wrong/quiz">오답 테스트 (${Math.min(words.length, QUIZ_MAX)}문제) ›</a>
         <p class="muted small">테스트에서 맞히거나 체크하면 오답 노트에서 빠져요.</p>
         <ul id="wordList">${words.map((w) => wordRow(w, { showDay: true })).join('')}</ul>`
      : '<p class="empty">틀린 단어가 없어요 👍</p>'}
  `;
  bindWordList();
}

// ---------- 검색 ----------
function renderSearch() {
  app.innerHTML = `
    ${header('#/', '홈', '단어 검색')}
    <input type="search" id="q" placeholder="영단어 또는 뜻" autocomplete="off" autocapitalize="off">
    <p class="muted small" id="qinfo"></p>
    <ul id="wordList"></ul>
  `;
  const q = $('#q');
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    if (!s) { $('#wordList').innerHTML = ''; $('#qinfo').textContent = ''; return; }
    const hits = WORDS.filter((w) => w.en.toLowerCase().includes(s) || w.ko.includes(s));
    $('#qinfo').textContent = hits.length > 50 ? `${hits.length}개 중 50개 표시` : `${hits.length}개`;
    $('#wordList').innerHTML = hits.slice(0, 50).map((w) => wordRow(w, { showDay: true, open: true })).join('');
    bindWordList();
  };
  q.addEventListener('input', draw);
  q.focus();
}

// ---------- 4지선다 테스트 ----------
let quiz = null;

function startQuiz({ words, day = null, wrongNote = false, retry = false }) {
  const list = shuffle(words).slice(0, QUIZ_MAX);
  quiz = { list, idx: 0, score: 0, wrongs: [], day, wrongNote, retry, answered: false };
  if (!list.length) {
    app.innerHTML = `${header('#/wrong', '오답 노트', '오답 테스트')}<p class="empty">테스트할 단어가 없어요.</p>`;
    return;
  }
  renderQuestion();
}

function quizBack() {
  return quiz.day ? [`#/day/${quiz.day}`, `Day ${quiz.day}`] : ['#/wrong', '오답 노트'];
}

function renderQuestion() {
  const { list, idx } = quiz;
  if (idx >= list.length) return renderResult();
  const w = list[idx];
  const rev = store.rev;
  const [bh, bl] = quizBack();

  // 오답 보기: 같은 품사 우선, 뜻이 같은 단어 제외
  const pool = WORDS.filter((x) => x.en !== w.en && x.ko !== w.ko);
  const distractors = shuffle(pool.filter((x) => x.pos === w.pos)).slice(0, 3);
  if (distractors.length < 3) distractors.push(...shuffle(pool.filter((x) => !distractors.includes(x))).slice(0, 3 - distractors.length));
  const options = shuffle([w, ...distractors]);
  quiz.answered = false;

  app.innerHTML = `
    ${header(bh, bl, `${idx + 1} / ${list.length}`, `<span class="muted">정답 ${quiz.score}</span>`)}
    ${bar(pct(idx, list.length))}
    <div class="qcard">
      <div class="qword">${esc(rev ? w.ko : w.en)}</div>
      <div class="p">${esc(posLabel(w.pos))}</div>
    </div>
    <div class="choices">
      ${options.map((o, i) => `<button data-i="${i}">${esc(rev ? o.en : o.ko)}</button>`).join('')}
    </div>
    <div class="qfoot">
      <label class="toggle"><input type="checkbox" id="rev" ${rev ? 'checked' : ''}> 뜻 보고 단어 고르기</label>
      <button class="btn primary hidden" id="next">다음 ›</button>
    </div>
  `;
  $$('.choices button').forEach((b) =>
    b.addEventListener('click', () => answer(b, options[Number(b.dataset.i)] === w, w, options)));
  $('#rev').addEventListener('change', (e) => {
    store.rev = e.target.checked;
    store.save();
    if (!quiz.answered) renderQuestion();
  });
  $('#next').addEventListener('click', nextQuestion);
}

function answer(btn, correct, w, options) {
  if (quiz.answered) return;
  quiz.answered = true;
  const btns = $$('.choices button');
  btns.forEach((b) => (b.disabled = true));
  btns[options.indexOf(w)].classList.add('correct');
  if (correct) {
    quiz.score++;
    store.known.add(w.en);
    store.wrong.delete(w.en);
  } else {
    btn.classList.add('wrong');
    quiz.wrongs.push(w);
    store.known.delete(w.en);
    store.wrong.add(w.en);
  }
  store.save();
  speak(w.en);
  $('.right').innerHTML = `<span class="muted">정답 ${quiz.score}</span>`;
  // 맞히면 자동으로 다음, 틀리면 정답 확인 후 직접 넘김
  if (correct) setTimeout(() => { if (quiz && quiz.answered && btns[0].isConnected) nextQuestion(); }, 700);
  else $('#next').classList.remove('hidden');
}

function nextQuestion() {
  quiz.idx++;
  renderQuestion();
}

function renderResult() {
  const { list, score, wrongs, day, retry } = quiz;
  const total = list.length;
  if (day && !retry) store.best[day] = Math.max(store.best[day] ?? 0, score);
  store.save();
  const [bh, bl] = quizBack();
  const msg = score === total ? '완벽해요! 🎉' : score >= total * 0.8 ? '잘했어요!' : '틀린 단어를 한 번 더 봐요.';
  app.innerHTML = `
    ${header(bh, bl, '결과')}
    <div class="result">
      <div class="score">${score} <span>/ ${total}</span></div>
      <p>${msg}</p>
    </div>
    ${wrongs.length ? `
      <h2>틀린 단어 <span class="muted small">${wrongs.length}개</span></h2>
      <ul class="wlist">${wrongs.map((w) => `<li><b>${esc(w.en)}</b> <span class="p">${esc(posLabel(w.pos))}</span><div>${esc(w.ko)}</div></li>`).join('')}</ul>
      <button class="btn primary" id="retry">틀린 것만 다시 풀기</button>` : ''}
    <button class="btn${wrongs.length ? '' : ' primary'}" id="again">처음부터 다시</button>
    ${day && day < PARTS.length ? `<a class="btn" href="#/day/${day + 1}">다음: Day ${day + 1} ›</a>` : ''}
  `;
  const again = { words: quiz.retry ? list : (day ? PARTS[day - 1] : wrongWords()), day, wrongNote: quiz.wrongNote, retry: quiz.retry };
  $('#again').addEventListener('click', () => { startQuiz(again); window.scrollTo(0, 0); });
  if (wrongs.length) $('#retry').addEventListener('click', () => {
    startQuiz({ words: wrongs, day, wrongNote: quiz.wrongNote, retry: true });
    window.scrollTo(0, 0);
  });
}

// ---------- 시작 ----------
fetch('words.json')
  .then((r) => r.json())
  .then((data) => {
    WORDS = data.map(([en, pos, ko]) => ({ en, pos, ko }));
    const n = WORDS.length;
    PARTS = Array.from({ length: PART_COUNT }, (_, i) =>
      WORDS.slice(Math.round((i * n) / PART_COUNT), Math.round(((i + 1) * n) / PART_COUNT)));
    PARTS.forEach((p, i) => p.forEach((w) => (w.day = i + 1)));
    route();
  })
  .catch(() => {
    app.innerHTML = '<p class="empty">단어를 불러오지 못했어요.</p>';
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
