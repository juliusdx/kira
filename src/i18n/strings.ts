import type { Locale } from '../content/types'

// UI chrome strings (item content is localized in the content bundle itself).
export const UI = {
  appName: { en: 'Kira', ms: 'Kira' },
  tagline: {
    en: 'A few minutes of practice. Every day.',
    ms: 'Beberapa minit latihan. Setiap hari.',
  },
  start: { en: 'Start practice', ms: 'Mula latihan' },
  continue: { en: 'Continue', ms: 'Teruskan' },
  dueToday: { en: 'Due today', ms: 'Perlu ulang kaji' },
  newToday: { en: 'New', ms: 'Baharu' },
  streak: { en: 'Day streak', ms: 'Hari berturut' },
  progress: { en: 'Progress', ms: 'Kemajuan' },
  home: { en: 'Home', ms: 'Utama' },
  mastery: { en: 'Mastery', ms: 'Penguasaan' },
  allDone: { en: "You're all caught up!", ms: 'Semua sudah siap!' },
  allDoneSub: {
    en: 'No reviews due. Come back later, or start a fresh set.',
    ms: 'Tiada ulang kaji. Kembali kemudian, atau mula set baharu.',
  },
  correct: { en: 'Correct', ms: 'Betul' },
  incorrect: { en: 'Not quite', ms: 'Belum tepat' },
  check: { en: 'Check', ms: 'Semak' },
  next: { en: 'Next', ms: 'Seterusnya' },
  finish: { en: 'Finish', ms: 'Selesai' },
  submit: { en: 'Submit', ms: 'Hantar' },
  workedExample: { en: 'Worked example', ms: 'Contoh dikerjakan' },
  gotIt: { en: 'Got it', ms: 'Faham' },
  sessionComplete: { en: 'Session complete', ms: 'Sesi selesai' },
  reviewedN: { en: 'reviewed', ms: 'diulang kaji' },
  accuracy: { en: 'Accuracy', ms: 'Ketepatan' },
  backHome: { en: 'Back to home', ms: 'Kembali ke utama' },
  // question chrome
  debit: { en: 'Debit', ms: 'Debit' },
  credit: { en: 'Credit', ms: 'Kredit' },
  chooseAccount: { en: 'Choose account', ms: 'Pilih akaun' },
  amount: { en: 'Amount', ms: 'Amaun' },
  mustBalance: {
    en: 'Debits must equal credits to submit.',
    ms: 'Debit mesti sama dengan kredit untuk hantar.',
  },
  closingBalance: { en: 'Closing balance', ms: 'Baki penutup' },
  balanced: { en: 'Dr = Cr', ms: 'Debit = Kredit' },
  closeSession: { en: 'Close session', ms: 'Tutup sesi' },
  tapToAssign: {
    en: 'Tap each entry, then choose its side.',
    ms: 'Ketik setiap catatan, kemudian pilih sebelahnya.',
  },
  yourAnswer: { en: 'Your answer', ms: 'Jawapan anda' },
  correctAnswer: { en: 'Correct answer', ms: 'Jawapan betul' },
  // self-explanation
  whyTitle: { en: 'Before the answer — why?', ms: 'Sebelum jawapan — mengapa?' },
  whyBody: {
    en: 'Take a second: which rule decides this? Then reveal the explanation.',
    ms: 'Fikir sejenak: peraturan mana menentukannya? Kemudian dedah penjelasan.',
  },
  reveal: { en: 'Reveal explanation', ms: 'Dedah penjelasan' },
  // progress
  itemsMastered: { en: 'items mastered', ms: 'item dikuasai' },
  seen: { en: 'seen', ms: 'dilihat' },
  notStarted: { en: 'Not started', ms: 'Belum mula' },
  resetProgress: { en: 'Reset progress', ms: 'Set semula kemajuan' },
  resetConfirm: {
    en: 'Reset all progress on this device? This cannot be undone.',
    ms: 'Set semula semua kemajuan pada peranti ini? Tidak boleh dibatalkan.',
  },
  offlineReady: { en: 'Offline-ready', ms: 'Sedia luar talian' },
} as const

export type UIKey = keyof typeof UI

export function tr(key: UIKey, locale: Locale): string {
  return UI[key][locale]
}
