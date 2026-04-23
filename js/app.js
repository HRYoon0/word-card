// ===================================================================
// 영어 단어 카드 앱 - 메인 로직
// ===================================================================

let lessons = Store.load();          // 현재 레슨 데이터
let currentLesson = null;            // 선택된 레슨
let studyIndex = 0;                  // 학습 모드 현재 카드 인덱스
let gameState = null;                // 게임 상태 (시작 시 초기화)

// ===================================================================
// 뷰 전환
// ===================================================================
const views = ['Home', 'Mode', 'Study', 'Game', 'Result', 'Teacher'];

function showView(name) {
  views.forEach(v => {
    const el = document.getElementById('view' + v);
    if (el) el.hidden = (v !== name);
  });
  document.getElementById('backBtn').hidden = (name === 'Home');
  window.scrollTo(0, 0);
}

document.getElementById('backBtn').onclick = () => {
  if (!document.getElementById('viewMode').hidden) showView('Home');
  else if (!document.getElementById('viewStudy').hidden) showView('Mode');
  else if (!document.getElementById('viewGame').hidden) {
    if (confirm('게임을 중단할까요? 진행 내용이 사라져요.')) showView('Mode');
  }
  else if (!document.getElementById('viewResult').hidden) showView('Home');
  else if (!document.getElementById('viewTeacher').hidden) {
    lessons = Store.load();
    renderLessonList();
    showView('Home');
  }
};

document.getElementById('teacherBtn').onclick = () => {
  renderTeacherPanel();
  showView('Teacher');
};

// ===================================================================
// DOM 생성 헬퍼 - textContent 기반으로 XSS 원천 차단
// ===================================================================
function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  }
  if (opts.on) {
    for (const [ev, fn] of Object.entries(opts.on)) node.addEventListener(ev, fn);
  }
  children.forEach(c => {
    if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

// ===================================================================
// 발음 재생 - Web Speech API
// 기본 음성은 품질이 낮은 구형 음성이 선택될 수 있어, 고품질 음성을 우선순위로 선택
// ===================================================================
let bestVoice = null;

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  // 우선순위: Samantha(macOS 최고 품질) > 기타 고품질 영어 음성 > en-US > 아무 영어
  const preferred = ['Samantha', 'Karen', 'Daniel', 'Google US English', 'Microsoft Zira'];
  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name) && v.lang.startsWith('en'));
    if (v) { bestVoice = v; return; }
  }
  bestVoice = voices.find(v => v.lang === 'en-US')
           || voices.find(v => v.lang.startsWith('en'))
           || null;
}

// 음성 목록은 비동기 로드되므로 초기 + 변경 이벤트 양쪽에서 준비
if (window.speechSynthesis) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.75;        // 초등학생이 따라 말하기 좋은 속도
  u.pitch = 1.1;        // 약간 높은 톤이 더 친근하고 또박또박
  u.volume = 1.0;
  if (bestVoice) u.voice = bestVoice;
  speechSynthesis.speak(u);
}

// ===================================================================
// 홈 - 레슨 목록
// ===================================================================
function renderLessonList() {
  const container = document.getElementById('lessonList');
  container.replaceChildren();
  if (lessons.length === 0) {
    container.appendChild(el('p', {
      className: 'hint',
      text: '등록된 레슨이 없어요. 선생님 모드에서 추가해 주세요.',
      attrs: { style: 'text-align:center;grid-column:1/-1' }
    }));
    return;
  }
  lessons.forEach(lesson => {
    const card = el('div', {
      className: 'lesson-card',
      on: { click: () => selectLesson(lesson) }
    }, [
      el('span', { className: 'emoji', text: lesson.emoji || '📚' }),
      el('div', { className: 'title', text: lesson.name }),
      el('div', { className: 'count', text: `단어 ${lesson.words.length}개` })
    ]);
    container.appendChild(card);
  });
}

function selectLesson(lesson) {
  if (lesson.words.length === 0) {
    alert('이 레슨에는 단어가 없어요. 선생님 모드에서 단어를 추가해 주세요.');
    return;
  }
  currentLesson = lesson;
  document.getElementById('modeLessonTitle').textContent = lesson.name;
  showView('Mode');
}

// ===================================================================
// 모드 선택
// ===================================================================
document.getElementById('studyModeBtn').onclick = () => {
  studyIndex = 0;
  renderStudyCard();
  showView('Study');
};
document.getElementById('gameModeBtn').onclick = () => {
  startGame();
  showView('Game');
};

// ===================================================================
// 학습 모드 - 카드 뒤집기
// ===================================================================
const flashcard = document.getElementById('flashcard');

function renderStudyCard() {
  const word = currentLesson.words[studyIndex];
  const wordEl = document.getElementById('cardWord');
  const meaningEl = document.getElementById('cardMeaning');
  wordEl.textContent = word.en;
  meaningEl.textContent = word.ko;
  document.getElementById('studyProgress').textContent =
    `${studyIndex + 1} / ${currentLesson.words.length}`;

  flashcard.classList.remove('flipped');

  document.getElementById('prevBtn').disabled = (studyIndex === 0);
  document.getElementById('nextBtn').textContent =
    (studyIndex === currentLesson.words.length - 1) ? '완료 ✓' : '다음 ▶';

  // 단어 길이에 따라 폰트 자동 축소 (grandfather 같은 긴 단어도 잘리지 않게)
  // requestAnimationFrame: 브라우저가 레이아웃을 마친 뒤 측정해야 정확함
  requestAnimationFrame(() => {
    fitText(wordEl, 160, 48);
    fitText(meaningEl, 140, 40);
  });

  setTimeout(() => speak(word.en), 250);
}

// 주어진 요소의 글자를 컨테이너 폭에 맞게 축소
// 원리: white-space:nowrap 상태에서 scrollWidth(내용 실제 너비) vs
//       offsetWidth(컨테이너가 허용하는 너비)를 비교해 비례 축소
function fitText(elem, maxPx, minPx) {
  elem.style.fontSize = maxPx + 'px';
  if (elem.offsetWidth <= 0) return;
  if (elem.scrollWidth > elem.offsetWidth) {
    const ratio = elem.offsetWidth / elem.scrollWidth;
    const newSize = Math.max(minPx, Math.floor(maxPx * ratio * 0.96));
    elem.style.fontSize = newSize + 'px';
  }
}

flashcard.onclick = (e) => {
  if (e.target.closest('.speaker-btn')) return;
  flashcard.classList.toggle('flipped');
};
flashcard.onkeydown = (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    flashcard.classList.toggle('flipped');
  }
};

document.getElementById('speakBtn').onclick = (e) => {
  e.stopPropagation();
  speak(currentLesson.words[studyIndex].en);
};

document.getElementById('prevBtn').onclick = () => {
  if (studyIndex > 0) { studyIndex--; renderStudyCard(); }
};
document.getElementById('nextBtn').onclick = () => {
  if (studyIndex < currentLesson.words.length - 1) {
    studyIndex++;
    renderStudyCard();
  } else {
    if (confirm('모든 단어를 공부했어요! 게임으로 확인해볼까요?')) {
      startGame();
      showView('Game');
    } else {
      showView('Mode');
    }
  }
};

// ===================================================================
// 게임 모드 - 4지선다
// ===================================================================
function startGame() {
  const words = shuffle([...currentLesson.words]);
  gameState = {
    queue: words,
    total: words.length,
    answeredCount: 0,
    score: 0,
    wrong: [],
  };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  if (gameState.queue.length === 0) {
    endGame();
    return;
  }
  const current = gameState.queue[0];

  document.getElementById('quizWord').textContent = current.en;
  document.getElementById('gameProgress').textContent =
    `${gameState.answeredCount + 1} / ${gameState.total}`;
  document.getElementById('gameScore').textContent = `⭐ ${gameState.score}점`;
  const feedbackEl = document.getElementById('feedback');
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';

  // 오답 3개를 전체 단어풀에서 선택 (단어가 4개 미만이면 있는 만큼만)
  const pool = currentLesson.words.filter(w => w.ko !== current.ko);
  const wrongChoices = shuffle(pool).slice(0, 3);
  const choices = shuffle([current, ...wrongChoices]);

  const choicesEl = document.getElementById('choices');
  choicesEl.replaceChildren();
  choices.forEach(choice => {
    const btn = el('button', {
      className: 'choice-btn',
      text: choice.ko,
      on: { click: () => handleAnswer(btn, choice, current) }
    });
    choicesEl.appendChild(btn);
  });

  setTimeout(() => speak(current.en), 200);
}

document.getElementById('quizSpeakBtn').onclick = () => {
  if (gameState && gameState.queue.length > 0) {
    speak(gameState.queue[0].en);
  }
};

function handleAnswer(btn, chosen, correct) {
  const allButtons = document.querySelectorAll('.choice-btn');
  allButtons.forEach(b => {
    b.disabled = true;
    if (b.textContent === correct.ko) b.classList.add('correct');
  });

  const isCorrect = chosen.ko === correct.ko;
  const feedback = document.getElementById('feedback');

  if (isCorrect) {
    gameState.score++;
    feedback.textContent = '🎉 정답!';
    feedback.className = 'feedback correct';
  } else {
    btn.classList.add('wrong');
    gameState.wrong.push(correct);
    feedback.textContent = `❌ 정답은 "${correct.ko}"`;
    feedback.className = 'feedback wrong';
  }

  gameState.answeredCount++;
  const finishedWord = gameState.queue.shift();

  // ⭐ 여기가 선생님이 채울 부분 ⭐
  handleWrongWord(isCorrect, finishedWord, gameState.queue);

  setTimeout(() => renderQuizQuestion(), isCorrect ? 1000 : 1800);
}

// ===================================================================
// ⭐⭐⭐ 선생님이 작성할 함수 ⭐⭐⭐
// ===================================================================
// 목적: 한 문제를 풀었을 때 그 단어를 어떻게 처리할지 결정
//
// 파라미터:
//   - isCorrect: 학생이 맞췄는지 (true/false)
//   - word: 방금 푼 단어 객체 { en, ko }
//   - queue: 남은 문제 배열 (직접 수정 가능 — push, splice 등)
//
// 선택지:
//   A) 틀려도 그냥 넘어가기 (빈 함수 그대로 두기)
//   B) 틀리면 큐 맨 뒤에 다시 추가 → 끝나기 전 다시 풀게 됨
//   C) 틀리면 3~4문제 뒤에 다시 등장 (간격 반복, 장기기억에 효과적)
//
// ⚠️ 중요: 단어를 큐에 다시 넣었다면 gameState.total도 +1 해주세요
//          (진행도 표시 "3/10" 이 맞게 돌아가도록)
//
// 예시 (B안 - 단순한 다시 풀기):
//   if (!isCorrect) {
//     queue.push(word);
//     gameState.total++;
//   }
//
// 예시 (C안 - 3문제 뒤 재등장):
//   if (!isCorrect) {
//     const insertAt = Math.min(3, queue.length);
//     queue.splice(insertAt, 0, word);
//     gameState.total++;
//   }
// ===================================================================
function handleWrongWord(isCorrect, word, queue) {
  // B안: 틀린 단어를 큐 맨 뒤에 다시 추가 → 라운드 끝나기 전 재도전
  if (!isCorrect) {
    queue.push(word);
    gameState.total++;   // 진행도 표시("5/10")가 맞게 전체 문제 수도 함께 증가
  }
}

// ===================================================================
// 게임 종료 - 결과 화면
// ===================================================================
function endGame() {
  document.getElementById('finalScore').textContent = gameState.score;

  const percentage = Math.round((gameState.score / gameState.total) * 100);
  let message = '';
  if (percentage === 100) message = '🏆 완벽해요! 모두 맞췄어요!';
  else if (percentage >= 80) message = '😄 훌륭해요! 거의 다 맞췄네요.';
  else if (percentage >= 60) message = '🙂 잘하고 있어요. 조금만 더!';
  else message = '💪 괜찮아요. 학습 모드로 다시 복습해봐요.';
  document.getElementById('resultMessage').textContent = message;

  const wrongList = document.getElementById('wrongList');
  wrongList.replaceChildren();
  // 중복 제거 - 같은 단어를 여러 번 틀린 경우 한 번만 표시
  const uniqueWrong = [...new Map(gameState.wrong.map(w => [w.en, w])).values()];
  if (uniqueWrong.length > 0) {
    const titleLi = el('li', {
      attrs: { style: 'background:transparent;border-left:none' }
    }, [
      el('strong', { text: '📌 다시 봐야 할 단어:' })
    ]);
    wrongList.appendChild(titleLi);

    uniqueWrong.forEach(w => {
      const li = el('li', {}, [
        el('strong', { text: w.en }),
        ' — ',
        w.ko
      ]);
      wrongList.appendChild(li);
    });
  }

  showView('Result');
}

document.getElementById('retryBtn').onclick = () => {
  startGame();
  showView('Game');
};
document.getElementById('homeBtn').onclick = () => showView('Home');

// ===================================================================
// 선생님 모드 - 레슨/단어 편집
// ===================================================================
let editingLessonId = null;

function renderTeacherPanel() {
  const listEl = document.getElementById('teacherLessonList');
  listEl.replaceChildren();
  lessons.forEach(lesson => {
    const delBtn = el('button', {
      className: 'del-btn',
      text: '🗑',
      attrs: { title: '레슨 삭제' },
      on: {
        click: (e) => {
          e.stopPropagation();
          if (confirm(`"${lesson.name}" 레슨을 삭제할까요?`)) {
            lessons = lessons.filter(l => l.id !== lesson.id);
            if (editingLessonId === lesson.id) editingLessonId = null;
            Store.save(lessons);
            renderTeacherPanel();
          }
        }
      }
    });
    const li = el('li', {
      className: lesson.id === editingLessonId ? 'active' : '',
      on: {
        click: () => {
          editingLessonId = lesson.id;
          renderTeacherPanel();
        }
      }
    }, [
      el('span', { text: `${lesson.emoji || '📚'} ${lesson.name} (${lesson.words.length})` }),
      delBtn
    ]);
    listEl.appendChild(li);
  });
  renderWordEditor();
}

function renderWordEditor() {
  const editor = document.getElementById('wordEditor');
  const hint = document.getElementById('editorHint');
  const title = document.getElementById('editingLessonTitle');
  const lesson = lessons.find(l => l.id === editingLessonId);

  if (!lesson) {
    editor.hidden = true;
    hint.hidden = false;
    title.textContent = '단어 편집';
    return;
  }
  editor.hidden = false;
  hint.hidden = true;
  title.textContent = `"${lesson.name}" 단어 편집`;

  const wordList = document.getElementById('wordList');
  wordList.replaceChildren();
  lesson.words.forEach((w, idx) => {
    const delBtn = el('button', {
      className: 'del-btn',
      text: '🗑',
      attrs: { title: '단어 삭제' },
      on: {
        click: () => {
          lesson.words.splice(idx, 1);
          Store.save(lessons);
          renderWordEditor();
          renderTeacherPanel();
        }
      }
    });
    const li = el('li', {}, [
      el('span', { className: 'eng', text: w.en }),
      el('span', { className: 'kor', text: w.ko }),
      delBtn
    ]);
    wordList.appendChild(li);
  });
}

// 새 레슨의 기본 이모지 풀 - 초등학생이 좋아할 만한 귀여운 것들
const LESSON_EMOJIS = ['📚','🌈','🦄','🐰','🌸','🍭','🎈','⭐','🍉','🦋','🌻','🐢','🍓','🎨','🧸'];

document.getElementById('addLessonBtn').onclick = () => {
  const input = document.getElementById('newLessonName');
  const name = input.value.trim();
  if (!name) return;
  const newLesson = {
    id: 'lesson_' + Date.now(),
    name: name,
    emoji: LESSON_EMOJIS[Math.floor(Math.random() * LESSON_EMOJIS.length)],
    words: []
  };
  lessons.push(newLesson);
  Store.save(lessons);
  input.value = '';
  editingLessonId = newLesson.id;
  renderTeacherPanel();
};
document.getElementById('newLessonName').onkeydown = (e) => {
  if (e.key === 'Enter') document.getElementById('addLessonBtn').click();
};

document.getElementById('addWordBtn').onclick = () => {
  const enInput = document.getElementById('newEnglish');
  const koInput = document.getElementById('newKorean');
  const en = enInput.value.trim();
  const ko = koInput.value.trim();
  if (!en || !ko) return;
  const lesson = lessons.find(l => l.id === editingLessonId);
  lesson.words.push({ en, ko });
  Store.save(lessons);
  enInput.value = '';
  koInput.value = '';
  enInput.focus();
  renderWordEditor();
  renderTeacherPanel();
};
document.getElementById('newKorean').onkeydown = (e) => {
  if (e.key === 'Enter') document.getElementById('addWordBtn').click();
};
document.getElementById('newEnglish').onkeydown = (e) => {
  if (e.key === 'Enter') document.getElementById('newKorean').focus();
};

// 내보내기 / 가져오기 / 초기화
document.getElementById('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(lessons, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'word_lessons_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById('importBtn').onclick = () => {
  document.getElementById('importFile').click();
};
document.getElementById('importFile').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error('형식 오류');
      data.forEach(l => {
        if (!l.id || !l.name || !Array.isArray(l.words)) throw new Error('레슨 형식 오류');
      });
      lessons = data;
      Store.save(lessons);
      editingLessonId = null;
      renderTeacherPanel();
      alert('가져오기 완료!');
    } catch (err) {
      alert('파일을 읽을 수 없어요: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

document.getElementById('resetBtn').onclick = () => {
  if (confirm('모든 레슨을 기본값으로 되돌릴까요? 편집 내용이 사라집니다.')) {
    lessons = Store.reset();
    editingLessonId = null;
    renderTeacherPanel();
  }
};

// ===================================================================
// 구글 시트 연동
// ===================================================================
const SHEET_URL_KEY = 'wordcard_sheet_url';

// 선생님이 붙여넣는 URL의 다양한 형태를 보정
function normalizeSheetUrl(url) {
  url = (url || '').trim();
  if (!url) throw new Error('URL을 입력해주세요.');
  if (!url.includes('docs.google.com')) {
    throw new Error('구글 시트 URL이 아닙니다.');
  }
  if (url.includes('/edit')) {
    throw new Error('"편집 URL"이 아닌 "웹에 게시" URL이 필요해요.\n파일 → 공유 → 웹에 게시를 이용하세요.');
  }
  // 게시된 URL이지만 output 파라미터가 없으면 CSV로 강제
  if (!/output=(csv|tsv)/.test(url)) {
    url += (url.includes('?') ? '&' : '?') + 'output=csv';
  }
  return url;
}

// 제대로 된 CSV 파서 - 따옴표 안의 쉼표/개행도 처리
// (이게 중요한 이유: "누나, 언니, 여동생" 같은 한글 값이 흔함)
function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  const len = text.length;
  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; }
      else if (c === '"') { inQuotes = false; i++; }
      else { field += c; i++; }
    } else {
      if (c === '"') { inQuotes = true; i++; }
      else if (c === ',') { row.push(field); field = ''; i++; }
      else if (c === '\r') { i++; }
      else if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; i++; }
      else { field += c; i++; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// CSV 행을 레슨 구조로 변환
// 지원 포맷:
//   A) 4열: Lesson | Emoji | English | Korean
//   B) 3열: Lesson | English | Korean
function rowsToLessons(rows) {
  if (rows.length < 2) return [];

  // 헤더 행을 분석해 emoji 열이 있는지 판단
  const header = (rows[0] || []).map(c => (c || '').trim().toLowerCase());
  const hasEmojiCol = header.some(h => h === 'emoji' || h === '이모지' || h === '그림');

  const map = new Map();
  let lessonIdx = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c => !c || !c.trim())) continue;

    let lessonName, emoji, en, ko;
    if (hasEmojiCol) {
      [lessonName, emoji, en, ko] = row;
    } else {
      [lessonName, en, ko] = row;
      emoji = '';
    }

    const nameTrim = (lessonName || '').trim();
    const enTrim = (en || '').trim();
    const koTrim = (ko || '').trim();
    if (!nameTrim || !enTrim || !koTrim) continue;  // 필수 필드 누락 행은 건너뜀

    if (!map.has(nameTrim)) {
      lessonIdx++;
      map.set(nameTrim, {
        id: 'sheet_' + lessonIdx,
        name: nameTrim,
        emoji: (emoji || '').trim() || LESSON_EMOJIS[(lessonIdx - 1) % LESSON_EMOJIS.length],
        words: []
      });
    }
    map.get(nameTrim).words.push({ en: enTrim, ko: koTrim });
  }
  return [...map.values()];
}

async function loadFromSheet(rawUrl, opts = {}) {
  const { silent = false } = opts;
  const statusEl = document.getElementById('sheetStatus');
  const setStatus = (text, cls = '') => {
    if (silent || !statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'sheet-status ' + cls;
  };

  let url;
  try {
    url = normalizeSheetUrl(rawUrl);
  } catch (err) {
    setStatus('❌ ' + err.message, 'error');
    return false;
  }

  setStatus('⏳ 불러오는 중...');

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`서버 응답 오류 (${res.status})`);
    const text = await res.text();
    const rows = parseCSV(text);
    const newLessons = rowsToLessons(rows);
    if (newLessons.length === 0) {
      throw new Error('시트에서 단어를 찾지 못했어요. 형식을 확인해주세요.');
    }
    lessons = newLessons;
    Store.save(lessons);
    localStorage.setItem(SHEET_URL_KEY, url);

    const wordCount = newLessons.reduce((s, l) => s + l.words.length, 0);
    setStatus(`✅ ${newLessons.length}개 레슨, ${wordCount}개 단어 불러옴!`, 'success');
    if (!silent) {
      renderTeacherPanel();
      updateShareUrl(url);
    }
    return true;
  } catch (err) {
    setStatus('❌ ' + err.message, 'error');
    return false;
  }
}

function updateShareUrl(sheetUrl) {
  const shareBox = document.getElementById('sheetShareBox');
  const shareInput = document.getElementById('shareUrl');
  if (!shareBox || !shareInput) return;
  const base = location.origin + location.pathname;
  shareInput.value = base + '?sheet=' + encodeURIComponent(sheetUrl);
  shareBox.hidden = false;
}

// 학기 초 예시 데이터 — 선생님이 구글 시트에 붙여넣기 편하도록
function downloadTemplateCsv() {
  const csv = [
    'Lesson,Emoji,English,Korean',
    '"1. Hello",👋,hello,안녕하세요',
    '"1. Hello",👋,name,이름',
    '"1. Hello",👋,nice,멋진',
    '"2. Family",👨‍👩‍👧,father,아버지',
    '"2. Family",👨‍👩‍👧,mother,어머니',
    '"2. Family",👨‍👩‍👧,"brother, elder","형, 오빠"',
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wordcard_template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// 시트 UI 이벤트 바인딩 (페이지 로드 시 한 번)
function initSheetUI() {
  const savedUrl = localStorage.getItem(SHEET_URL_KEY);
  const urlInput = document.getElementById('sheetUrl');
  if (savedUrl) {
    urlInput.value = savedUrl;
    updateShareUrl(savedUrl);
  }

  document.getElementById('syncSheetBtn').onclick = async () => {
    await loadFromSheet(urlInput.value);
  };
  urlInput.onkeydown = (e) => {
    if (e.key === 'Enter') document.getElementById('syncSheetBtn').click();
  };

  document.getElementById('toggleSheetHelpBtn').onclick = () => {
    const help = document.getElementById('sheetHelp');
    help.hidden = !help.hidden;
    document.getElementById('toggleSheetHelpBtn').textContent =
      help.hidden ? '사용 방법 ▼' : '사용 방법 ▲';
  };

  document.getElementById('downloadTemplateBtn').onclick = downloadTemplateCsv;

  // 공유 URL 클릭 시 자동 복사
  document.getElementById('shareUrl').onclick = async function () {
    this.select();
    try {
      await navigator.clipboard.writeText(this.value);
      const s = document.getElementById('sheetStatus');
      s.textContent = '📋 공유 링크가 복사되었어요!';
      s.className = 'sheet-status success';
    } catch {
      // clipboard API 실패 시 수동 복사 필요
    }
  };
}

// 페이지 로드 시: URL 파라미터나 저장된 URL이 있으면 자동 동기화
async function bootstrapSheet() {
  const params = new URLSearchParams(location.search);
  const urlFromParam = params.get('sheet');
  const urlFromStorage = localStorage.getItem(SHEET_URL_KEY);
  const target = urlFromParam || urlFromStorage;
  if (!target) return;

  // silent 모드로 백그라운드 동기화 — 실패해도 캐시된 데이터 사용
  const ok = await loadFromSheet(target, { silent: true });
  if (ok) {
    renderLessonList();
    // URL 파라미터로 들어온 경우 깔끔하게 ?sheet=... 제거 (북마크하기 좋게)
    if (urlFromParam) {
      history.replaceState({}, '', location.pathname);
    }
  }
}

// ===================================================================
// 유틸리티
// ===================================================================
function shuffle(arr) {
  // Fisher-Yates 셔플 — 편향 없는 표준 섞기 알고리즘
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 창 크기가 바뀌면 현재 학습 카드를 다시 맞춤 (방향 전환, 창 크기 조절 대응)
window.addEventListener('resize', () => {
  if (!document.getElementById('viewStudy').hidden && currentLesson) {
    const wordEl = document.getElementById('cardWord');
    const meaningEl = document.getElementById('cardMeaning');
    fitText(wordEl, 160, 48);
    fitText(meaningEl, 140, 40);
  }
});

// ===================================================================
// 초기 렌더링
// ===================================================================
initSheetUI();          // 시트 연동 UI 이벤트 바인딩
renderLessonList();
showView('Home');
bootstrapSheet();       // 저장된 URL이나 ?sheet= 파라미터가 있으면 백그라운드 동기화
