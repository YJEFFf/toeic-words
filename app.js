// 토익 단어 암기 PWA
// words.json 형식: [영단어, 품사, 뜻, (사용 안 함)]

const POS_KO = {
  n: '명사', v: '동사', adj: '형용사', adv: '부사', phr: '구',
  conj: '접속사', prep: '전치사', 'n/v': '명사/동사', 'adj/n': '형용사/명사', 'v/n': '동사/명사',
};
const QUIZ_LEN = 20;

let WORDS = [];
const store = {
  known: new Set(JSON.parse(localStorage.getItem('known') || '[]')),
  wrong: new Set(JSON.parse(localStorage.getItem('wrong') || '[]')),
  save() {
    localStorage.setItem('known', JSON.stringify([...this.known]));
    localStorage.setItem('wrong', JSON.stringify([...this.wrong]));
  },
};

const $ = (id) => document.getElementById(id);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const posLabel = (p) => POS_KO[p] || p;

// ---------- 화면 전환 ----------
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
  if (id === 'home') renderHome();
  if (id === 'quiz') startQuiz();
  if (id === 'list') { $('search').value = ''; listPage = 0; renderList(); }
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
document.querySelectorAll('.back').forEach((b) => b.addEventListener('click', () => show('home')));

// ---------- 범위 ----------
function scopedWords() {
  const scope = $('scope').value;
  if (scope === 'unknown') return WORDS.filter((w) => !store.known.has(w.en));
  if (scope === 'wrong') return WORDS.filter((w) => store.wrong.has(w.en));
  return WORDS;
}
$('scope').value = localStorage.getItem('scope') || 'unknown';
$('scope').addEventListener('change', () => {
  localStorage.setItem('scope', $('scope').value);
  renderHome();
});

// ---------- 홈 ----------
function renderHome() {
  const known = WORDS.filter((w) => store.known.has(w.en)).length;
  const pct = WORDS.length ? Math.round((known / WORDS.length) * 100) : 0;
  $('stats').innerHTML =
    `외운 단어 <b>${known}</b> / ${WORDS.length} (${pct}%) · 오답 노트 <b>${store.wrong.size}</b>` +
    `<div class="progressbar"><div style="width:${pct}%"></div></div>`;
  $('scopeCount').textContent = `선택한 범위: ${scopedWords().length}개`;
}

$('reset').addEventListener('click', () => {
  if (!confirm('외운 단어와 오답 노트를 모두 지울까요?')) return;
  store.known.clear();
  store.wrong.clear();
  store.save();
  renderHome();
});

// ---------- 발음 ----------
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

// ---------- 퀴즈 ----------
let qList = [];
let qIdx = 0;
let qScore = 0;

$('reverseQ').checked = localStorage.getItem('reverseQ') === '1';
$('reverseQ').addEventListener('change', () => {
  localStorage.setItem('reverseQ', $('reverseQ').checked ? '1' : '0');
  if (qIdx < qList.length) renderQuestion();
});

function startQuiz() {
  qList = shuffle(scopedWords()).slice(0, QUIZ_LEN);
  qIdx = 0;
  qScore = 0;
  renderQuestion();
}

function renderQuestion() {
  const done = qIdx >= qList.length;
  $('quizDone').classList.toggle('hidden', !done);
  $('qNext').classList.add('hidden');
  document.querySelector('#quiz .card').classList.toggle('hidden', done);
  $('choices').classList.toggle('hidden', done);
  if (done) {
    $('quizProgress').textContent = '';
    $('quizScore').textContent = qList.length
      ? `${qList.length}문제 중 ${qScore}개 정답!`
      : '선택한 범위에 단어가 없어요.';
    return;
  }
  $('quizProgress').textContent = `${qIdx + 1} / ${qList.length} · 정답 ${qScore}`;

  const w = qList[qIdx];
  const rev = $('reverseQ').checked;
  $('qWord').textContent = rev ? w.ko : w.en;
  $('qPos').textContent = posLabel(w.pos);

  // 오답 보기: 같은 품사 우선, 뜻이 같은 단어는 제외
  const pool = WORDS.filter((x) => x.en !== w.en && x.ko !== w.ko);
  const samePos = shuffle(pool.filter((x) => x.pos === w.pos));
  const distractors = samePos.slice(0, 3);
  if (distractors.length < 3) distractors.push(...shuffle(pool).filter((x) => !distractors.includes(x)).slice(0, 3 - distractors.length));
  const options = shuffle([w, ...distractors]);

  $('choices').innerHTML = '';
  options.forEach((opt) => {
    const b = document.createElement('button');
    b.textContent = rev ? opt.en : opt.ko;
    b.addEventListener('click', () => answer(b, opt === w, w));
    $('choices').appendChild(b);
  });
}

function answer(btn, correct, w) {
  const buttons = [...$('choices').children];
  if (buttons.some((b) => b.disabled)) return;
  buttons.forEach((b) => (b.disabled = true));
  const rev = $('reverseQ').checked;
  const answerText = rev ? w.en : w.ko;
  buttons.forEach((b) => b.textContent === answerText && b.classList.add('correct'));
  if (correct) {
    qScore++;
    store.wrong.delete(w.en);
  } else {
    btn.classList.add('wrong');
    store.wrong.add(w.en);
    store.known.delete(w.en);
  }
  store.save();
  $('quizProgress').textContent = `${qIdx + 1} / ${qList.length} · 정답 ${qScore}`;
  speak(w.en);
  $('qNext').classList.remove('hidden');
}

$('qNext').addEventListener('click', () => { qIdx++; renderQuestion(); });
$('quizAgain').addEventListener('click', startQuiz);

// ---------- 목록 ----------
const PAGE_SIZE = 20;
let listPage = 0;

function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const all = scopedWords().filter((w) => !q || w.en.toLowerCase().includes(q) || w.ko.includes(q));
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  listPage = Math.min(Math.max(listPage, 0), pages - 1);
  const items = all.slice(listPage * PAGE_SIZE, (listPage + 1) * PAGE_SIZE);
  $('listCount').textContent = `${all.length}개`;

  // 페이지 이동
  $('pager').classList.toggle('hidden', pages <= 1);
  $('prevPage').disabled = listPage === 0;
  $('nextPage').disabled = listPage === pages - 1;
  $('pageSelect').innerHTML = Array.from({ length: pages }, (_, i) =>
    `<option value="${i}">${i + 1} / ${pages}</option>`).join('');
  $('pageSelect').value = listPage;

  const ul = $('wordList');
  ul.innerHTML = '';
  const frag = document.createDocumentFragment();
  items.forEach((w) => {
    const li = document.createElement('li');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = store.known.has(w.en);
    cb.title = '외움';
    cb.addEventListener('change', () => {
      if (cb.checked) { store.known.add(w.en); store.wrong.delete(w.en); }
      else store.known.delete(w.en);
      store.save();
    });
    const txt = document.createElement('div');
    txt.className = 'txt';
    txt.innerHTML = `<span class="w"></span><span class="p"></span>${store.wrong.has(w.en) ? ' <span class="x">오답</span>' : ''}<div class="m covered"></div>`;
    txt.querySelector('.w').textContent = w.en;
    txt.querySelector('.p').textContent = w.pos;
    const m = txt.querySelector('.m');
    m.textContent = w.ko;
    // 탭하면 뜻 보이기/가리기 (보일 때 발음)
    txt.addEventListener('click', () => {
      if (m.classList.toggle('covered')) return;
      speak(w.en);
    });
    li.append(cb, txt);
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}
function goPage(n) {
  listPage = n;
  renderList();
  window.scrollTo(0, 0);
}
$('search').addEventListener('input', () => { listPage = 0; renderList(); });
$('prevPage').addEventListener('click', () => goPage(listPage - 1));
$('nextPage').addEventListener('click', () => goPage(listPage + 1));
$('pageSelect').addEventListener('change', () => goPage(Number($('pageSelect').value)));

// ---------- 시작 ----------
fetch('words.json')
  .then((r) => r.json())
  .then((data) => {
    WORDS = data.map(([en, pos, ko]) => ({ en, pos, ko }));
    renderHome();
  })
  .catch(() => {
    $('stats').textContent = '단어를 불러오지 못했어요.';
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
