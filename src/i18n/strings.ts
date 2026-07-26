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
  sortEachLine: {
    en: 'Sort each line, then work out the figure.',
    ms: 'Asingkan setiap baris, kemudian kira angkanya.',
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
  // account / identity
  account: { en: 'Account', ms: 'Akaun' },
  saveProgress: { en: 'Save my progress', ms: 'Simpan kemajuan saya' },
  saveProgressBody: {
    en: 'Add an email so your progress is kept if you change device or clear your browser.',
    ms: 'Tambah e-mel supaya kemajuan anda kekal jika anda tukar peranti atau kosongkan pelayar.',
  },
  emailLabel: { en: 'Email', ms: 'E-mel' },
  sendCode: { en: 'Send code', ms: 'Hantar kod' },
  codeLabel: { en: 'six-digit code', ms: 'kod enam digit' },
  codeSentTo: { en: 'We sent a code to', ms: 'Kami hantar kod ke' },
  verify: { en: 'Verify', ms: 'Sahkan' },
  signIn: { en: 'Sign in', ms: 'Log masuk' },
  signInBody: {
    en: 'Already added an email? Sign in to restore your progress.',
    ms: 'Sudah tambah e-mel? Log masuk untuk pulihkan kemajuan anda.',
  },
  signOut: { en: 'Sign out', ms: 'Log keluar' },
  savedAs: { en: 'Progress saved to', ms: 'Kemajuan disimpan ke' },
  notSaved: {
    en: 'Progress is on this device only',
    ms: 'Kemajuan hanya pada peranti ini',
  },
  // classes
  myClasses: { en: 'My classes', ms: 'Kelas saya' },
  joinClass: { en: 'Join a class', ms: 'Sertai kelas' },
  joinCode: { en: 'Join code', ms: 'Kod sertai' },
  enterJoinCode: { en: 'Enter the code from your teacher', ms: 'Masukkan kod daripada guru anda' },
  join: { en: 'Join', ms: 'Sertai' },
  joined: { en: 'Joined', ms: 'Telah sertai' },
  teacherView: { en: 'Teacher', ms: 'Guru' },
  newClass: { en: 'New class', ms: 'Kelas baharu' },
  className: { en: 'Class name', ms: 'Nama kelas' },
  create: { en: 'Create', ms: 'Cipta' },
  learners: { en: 'Learners', ms: 'Pelajar' },
  noLearners: {
    en: 'No one has joined yet. Share the join code.',
    ms: 'Belum ada yang sertai. Kongsi kod sertai.',
  },
  shareCode: { en: 'Share this code', ms: 'Kongsi kod ini' },
  copied: { en: 'Copied', ms: 'Disalin' },
  copyFailed: {
    en: "Couldn't copy — select the code above and copy it manually.",
    ms: 'Gagal menyalin — pilih kod di atas dan salin secara manual.',
  },
  newCode: { en: 'New code', ms: 'Kod baharu' },
  rotateConfirm: {
    en: 'Issue a new join code? The old one stops working; learners already in the class stay.',
    ms: 'Keluarkan kod baharu? Kod lama berhenti berfungsi; pelajar sedia ada kekal.',
  },
  lastActive: { en: 'Last active', ms: 'Aktif kali akhir' },
  never: { en: 'Never', ms: 'Tidak pernah' },
  weakest: { en: 'Needs work', ms: 'Perlu latihan' },
  remove: { en: 'Remove', ms: 'Buang' },
  removeConfirm: {
    en: 'Remove this learner from the class? Their progress is not deleted.',
    ms: 'Buang pelajar ini dari kelas? Kemajuan mereka tidak dipadam.',
  },
  needAccountForClass: {
    en: 'Add an email first so your class is not lost.',
    ms: 'Tambah e-mel dahulu supaya kelas anda tidak hilang.',
  },
  back: { en: 'Back', ms: 'Kembali' },
  loading: { en: 'Loading…', ms: 'Memuatkan…' },
} as const

export type UIKey = keyof typeof UI

export function tr(key: UIKey, locale: Locale): string {
  return UI[key][locale]
}
