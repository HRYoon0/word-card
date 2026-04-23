// ===================================================================
// 기본 레슨 데이터 - 초등 5학년 수준 단어 샘플
// 교사가 직접 편집/추가/삭제 가능 (localStorage에 저장됨)
// ===================================================================

const DEFAULT_LESSONS = [
  {
    id: 'lesson1',
    name: '1단원 - 학교 생활',
    emoji: '🏫',
    words: [
      { en: 'school', ko: '학교' },
      { en: 'teacher', ko: '선생님' },
      { en: 'student', ko: '학생' },
      { en: 'classroom', ko: '교실' },
      { en: 'desk', ko: '책상' },
      { en: 'book', ko: '책' },
      { en: 'pencil', ko: '연필' },
      { en: 'friend', ko: '친구' },
    ]
  },
  {
    id: 'lesson2',
    name: '2단원 - 가족',
    emoji: '👨‍👩‍👧',
    words: [
      { en: 'family', ko: '가족' },
      { en: 'father', ko: '아버지' },
      { en: 'mother', ko: '어머니' },
      { en: 'brother', ko: '형, 오빠, 남동생' },
      { en: 'sister', ko: '누나, 언니, 여동생' },
      { en: 'grandfather', ko: '할아버지' },
      { en: 'grandmother', ko: '할머니' },
      { en: 'baby', ko: '아기' },
    ]
  },
  {
    id: 'lesson3',
    name: '3단원 - 동물',
    emoji: '🐶',
    words: [
      { en: 'dog', ko: '개' },
      { en: 'cat', ko: '고양이' },
      { en: 'rabbit', ko: '토끼' },
      { en: 'tiger', ko: '호랑이' },
      { en: 'elephant', ko: '코끼리' },
      { en: 'monkey', ko: '원숭이' },
      { en: 'bird', ko: '새' },
      { en: 'fish', ko: '물고기' },
    ]
  },
  {
    id: 'lesson4',
    name: '4단원 - 음식',
    emoji: '🍎',
    words: [
      { en: 'apple', ko: '사과' },
      { en: 'banana', ko: '바나나' },
      { en: 'bread', ko: '빵' },
      { en: 'milk', ko: '우유' },
      { en: 'water', ko: '물' },
      { en: 'rice', ko: '쌀, 밥' },
      { en: 'chicken', ko: '닭, 닭고기' },
      { en: 'pizza', ko: '피자' },
    ]
  },
];

// ===================================================================
// 저장소 - localStorage를 감싼 유틸
// ===================================================================
const STORAGE_KEY = 'wordcard_lessons_v1';

const Store = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.save(DEFAULT_LESSONS);
      return structuredClone(DEFAULT_LESSONS);
    }
    try {
      return JSON.parse(raw);
    } catch {
      // 저장된 데이터가 손상됐을 때만 복구 — 이런 에러는 이론적으로 거의 없지만,
      // 학생 기기에서 일어나면 수업 자체가 막히므로 복구 경로를 둠
      console.warn('저장된 데이터가 손상되어 기본값으로 복구합니다');
      this.save(DEFAULT_LESSONS);
      return structuredClone(DEFAULT_LESSONS);
    }
  },
  save(lessons) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
  },
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    return this.load();
  }
};
