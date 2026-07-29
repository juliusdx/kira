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
  fillEachBlank: {
    en: 'The workings are started for you. Fill in what is missing.',
    ms: 'Kerja kira sudah dimulakan. Isikan yang tinggal.',
  },
  workings: { en: 'Workings', ms: 'Kerja kira' },
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
  // NOT "six-digit": Supabase's OTP length is a project setting (this project
  // issues 8), so the copy must not promise a specific length.
  codeLabel: { en: 'Code from the email', ms: 'Kod dari e-mel' },
  codeSentTo: { en: 'We sent an email to', ms: 'Kami hantar e-mel ke' },
  codeOrLink: {
    en: 'Enter the code from the email — or just click the link in it, then tap below.',
    ms: 'Masukkan kod dari e-mel — atau klik pautan di dalamnya, kemudian ketik di bawah.',
  },
  iClickedLink: { en: "I clicked the link — check now", ms: 'Saya klik pautan — semak sekarang' },
  notConfirmedYet: {
    en: 'Not confirmed yet. Open the email and click the link, then try again.',
    ms: 'Belum disahkan. Buka e-mel dan klik pautan, kemudian cuba lagi.',
  },
  verify: { en: 'Verify', ms: 'Sahkan' },
  signIn: { en: 'Sign in', ms: 'Log masuk' },
  signInBody: {
    en: 'Already added an email? Sign in to restore that account. This device shows that account only.',
    ms: 'Sudah tambah e-mel? Log masuk untuk pulihkan akaun itu. Peranti ini akan papar akaun itu sahaja.',
  },
  signInReplaceWarn: {
    en: 'This device has practice saved to a different account. Signing in replaces it with the account you sign into. Continue?',
    ms: 'Peranti ini ada latihan pada akaun lain. Log masuk akan menggantikannya dengan akaun yang anda log masuk. Teruskan?',
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
  // learner identity + collection
  editProfile: { en: 'Edit profile', ms: 'Sunting profil' },
  addYourName: { en: 'Add your name', ms: 'Tambah nama anda' },
  pickAvatar: { en: 'Pick your face', ms: 'Pilih wajah anda' },
  noBadgesYet: {
    en: 'Finish a session to earn your first.',
    ms: 'Selesaikan satu sesi untuk dapat yang pertama.',
  },
  toGo: { en: 'to go', ms: 'lagi' },
  earned: { en: 'Earned', ms: 'Diperoleh' },
  locked: { en: 'Still locked', ms: 'Masih berkunci' },
  perfectSession: { en: 'Flawless!', ms: 'Sempurna!' },
  stillDue: {
    en: '{n} more waiting whenever you are ready.',
    ms: '{n} lagi menunggu bila-bila anda sedia.',
  },
  comeBackTomorrow: {
    en: 'Nothing left due — come back tomorrow.',
    ms: 'Tiada lagi perlu diulang — kembali esok.',
  },
  // Without this the ratio reads either way round — and on the same screen
  // "By topic" shows a MASTERY percentage, where high is good. Say which.
  weakestHint: {
    en: 'Answers got wrong most often',
    ms: 'Jawapan yang paling kerap salah',
  },
  wrongLabel: { en: 'wrong', ms: 'salah' },
  // relative times — these render on every roster card, so they must localize
  today: { en: 'today', ms: 'hari ini' },
  yesterday: { en: 'yesterday', ms: 'semalam' },
  daysAgo: { en: '{n}d ago', ms: '{n} hari lalu' },
  monthsAgo: { en: '{n}mo ago', ms: '{n} bulan lalu' },
  // learner detail
  viewProgress: { en: 'See details', ms: 'Lihat butiran' },
  byTopic: { en: 'By topic', ms: 'Mengikut topik' },
  recentMisses: { en: 'Recently got wrong', ms: 'Baru-baru ini salah' },
  noMisses: {
    en: 'Nothing wrong yet — or not enough practice to tell.',
    ms: 'Belum ada yang salah — atau latihan belum cukup.',
  },
  notPractised: { en: 'Not practised yet', ms: 'Belum dilatih' },
  timesWrong: { en: '× wrong', ms: '× salah' },
  // a miss, opened up
  showQuestion: { en: 'See the question', ms: 'Lihat soalan' },
  hideQuestion: { en: 'Hide', ms: 'Sembunyi' },
  previewAsked: { en: '(asked)', ms: '(ditanya)' },
  previewGivenEntry: { en: 'Entry shown as wrong', ms: 'Catatan yang ditunjuk salah' },
  explanationSeen: {
    en: 'What the learner was told',
    ms: 'Apa yang diberitahu kepada pelajar',
  },
  whatTheyPut: { en: 'What they put', ms: 'Apa yang mereka jawab' },
  whatTheyPutHint: {
    en: 'Their most recent wrong answer. The parts in red are the mistake.',
    ms: 'Jawapan salah mereka yang terkini. Bahagian merah ialah kesilapannya.',
  },
  answerUnknown: {
    en: 'This answer was not recorded.',
    ms: 'Jawapan ini tidak direkodkan.',
  },
  itemMissing: {
    en: 'This question is no longer in the app.',
    ms: 'Soalan ini tiada lagi dalam aplikasi.',
  },
  siblingsCount: {
    en: '{n} other items drill these skills',
    ms: '{n} item lain melatih kemahiran ini',
  },
  siblingsNone: {
    en: 'Nothing else in the bank drills these skills',
    ms: 'Tiada lagi item yang melatih kemahiran ini',
  },
  betterExplanation: { en: 'A better explanation', ms: 'Penjelasan yang lebih baik' },
  betterExplanationHint: {
    en: 'Say it the way you would say it to them. Saved to your account when you tap away — only you can see it.',
    ms: 'Tulis seperti anda akan menerangkannya kepada mereka. Disimpan ke akaun anda apabila anda mengetik di luar kotak — hanya anda boleh melihatnya.',
  },
  noteSaving: { en: 'Saving…', ms: 'Menyimpan…' },
  noteSaved: { en: 'Saved', ms: 'Disimpan' },
  noteUnsaved: { en: 'Not saved yet', ms: 'Belum disimpan' },
  noteSaveFailed: {
    en: "Couldn't save — copy it out before you leave the page.",
    ms: 'Gagal menyimpan — salin sebelum meninggalkan halaman ini.',
  },
  betterExplanationPlaceholder: {
    en: 'e.g. the balance c/d goes on the smaller side, not the side the money is on…',
    ms: 'cth. baki c/d di sebelah yang lebih kecil, bukan di sebelah wang itu berada…',
  },
  copyBrief: { en: 'Copy request for the author', ms: 'Salin permintaan untuk penulis' },
  copyBriefFailed: {
    en: "Couldn't copy — select the text and copy it manually.",
    ms: 'Gagal menyalin — pilih teks dan salin secara manual.',
  },
  // leaving a class
  leaveClass: { en: 'Leave class', ms: 'Tinggalkan kelas' },
  leaveConfirm: {
    en: 'Leave this class? Your progress stays on your own account — the teacher just stops seeing it.',
    ms: 'Tinggalkan kelas ini? Kemajuan anda kekal dalam akaun anda — guru cuma tidak lagi melihatnya.',
  },
  // parent framing
  parentHint: {
    en: 'Tracking one child? Make a class, then enter its code once on their device.',
    ms: 'Menjejak seorang anak? Buat satu kelas, kemudian masukkan kodnya sekali pada peranti mereka.',
  },
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
  // reminders
  reminders: { en: 'Daily reminder', ms: 'Peringatan harian' },
  remindersBody: {
    en: 'A nudge when reviews are due. Spaced repetition only works if you come back on the day.',
    ms: 'Peringatan apabila ulang kaji perlu dibuat. Ulangan berjarak hanya berkesan jika anda kembali pada harinya.',
  },
  remindAt: { en: 'Remind me at', ms: 'Ingatkan saya pada' },
  remindersOn: { en: 'Turn on reminders', ms: 'Hidupkan peringatan' },
  remindersOff: { en: 'Turn off reminders', ms: 'Matikan peringatan' },
  remindersActive: { en: 'Reminders are on for this device', ms: 'Peringatan aktif untuk peranti ini' },
  remindersIos: {
    en: 'On iPhone, add Kira to your Home Screen first (Share → Add to Home Screen), then reminders can be turned on.',
    ms: 'Pada iPhone, tambah Kira ke Skrin Utama dahulu (Kongsi → Tambah ke Skrin Utama), kemudian peringatan boleh dihidupkan.',
  },
  remindersBlocked: {
    en: 'Notifications are blocked for this site. Allow them in your browser settings to use reminders.',
    ms: 'Pemberitahuan disekat untuk tapak ini. Benarkan dalam tetapan pelayar untuk menggunakan peringatan.',
  },
  testNotification: { en: 'Send a test notification', ms: 'Hantar pemberitahuan ujian' },
  testSent: {
    en: 'Sent. If nothing appeared, notifications are blocked at the system level.',
    ms: 'Dihantar. Jika tiada apa-apa muncul, pemberitahuan disekat pada peringkat sistem.',
  },
  testFailed: {
    en: 'Could not show a notification on this device.',
    ms: 'Tidak dapat memaparkan pemberitahuan pada peranti ini.',
  },
  // gamification
  badges: { en: 'Badges', ms: 'Lencana' },
  badgeEarned: { en: 'New badge earned!', ms: 'Lencana baharu diperoleh!' },
  bestRun: { en: 'Best run', ms: 'Rentetan terbaik' },
  leaderboard: { en: 'This week', ms: 'Minggu ini' },
  leaderboardHint: {
    en: 'Items practised in the last 7 days',
    ms: 'Item dilatih dalam 7 hari lepas',
  },
  you: { en: 'You', ms: 'Anda' },
  yourName: { en: 'Your name', ms: 'Nama anda' },
  yourNameHint: {
    en: 'Shown to your class on the leaderboard.',
    ms: 'Dipaparkan kepada kelas anda pada papan pendahulu.',
  },
  save: { en: 'Save', ms: 'Simpan' },
  noActivity: {
    en: 'No practice logged this week yet.',
    ms: 'Belum ada latihan direkod minggu ini.',
  },
  // auth errors, mapped from raw Supabase messages
  errNoAccount: {
    en: 'No account uses that email yet.',
    ms: 'Belum ada akaun menggunakan e-mel itu.',
  },
  errNoAccountFix: {
    en: 'Save my progress with this email instead',
    ms: 'Simpan kemajuan saya dengan e-mel ini',
  },
  errEmailTaken: {
    en: 'That email already belongs to another account. Sign in with it instead.',
    ms: 'E-mel itu milik akaun lain. Log masuk dengannya sebaliknya.',
  },
  errBadCode: {
    en: 'That code is wrong or has expired. Request a new one.',
    ms: 'Kod itu salah atau telah tamat tempoh. Minta kod baharu.',
  },
  errCooldown: {
    en: 'Just sent one — wait about a minute before asking again.',
    ms: 'Baru dihantar — tunggu kira-kira seminit sebelum minta lagi.',
  },
  errEmailQuota: {
    en: "This project's hourly email limit is used up. Try again later, or set up custom SMTP.",
    ms: 'Had e-mel sejam projek ini telah habis. Cuba lagi kemudian, atau sediakan SMTP tersendiri.',
  },
  errRateLimited: {
    en: 'Too many attempts. Wait a while and try again.',
    ms: 'Terlalu banyak percubaan. Tunggu sebentar dan cuba lagi.',
  },
  // classroom / roster failures (src/sync/classErrors.ts)
  errOffline: {
    en: 'No connection. Practice works offline — this progress report does not.',
    ms: 'Tiada sambungan. Latihan berfungsi luar talian — laporan kemajuan ini tidak.',
  },
  errSignedOut: {
    en: 'Signed out on this device. Open Account and sign in again.',
    ms: 'Telah log keluar pada peranti ini. Buka Akaun dan log masuk semula.',
  },
  errNotAllowed: {
    en: 'You do not have access to this class.',
    ms: 'Anda tiada akses kepada kelas ini.',
  },
  errBadJoinCode: {
    en: 'That code does not work. It may have been replaced — ask for a new one.',
    ms: 'Kod itu tidak berfungsi. Ia mungkin telah diganti — minta kod baharu.',
  },
  errAlreadyJoined: {
    en: 'You are already in this class.',
    ms: 'Anda sudah berada dalam kelas ini.',
  },
  errBackendMissing: {
    en: 'This part of the app is not ready on the server yet.',
    ms: 'Bahagian aplikasi ini belum sedia di pelayan.',
  },
  errClassGeneric: {
    en: "Couldn't load that. Try again.",
    ms: 'Gagal memuatkan. Cuba lagi.',
  },
  errRemoveFailed: {
    en: 'That learner was not removed. Try again.',
    ms: 'Pelajar itu tidak dibuang. Cuba lagi.',
  },
  // refreshing a report
  refresh: { en: 'Refresh', ms: 'Muat semula' },
  refreshing: { en: 'Refreshing…', ms: 'Memuat semula…' },
  asOf: { en: 'as of {t}', ms: 'setakat {t}' },
  justNow: { en: 'just now', ms: 'sebentar tadi' },
  minutesAgo: { en: '{n} min ago', ms: '{n} minit lalu' },
  hoursAgo: { en: '{n}h ago', ms: '{n} jam lalu' },
  offlineBanner: {
    en: 'Offline — showing the last report that loaded.',
    ms: 'Luar talian — memaparkan laporan terakhir yang dimuatkan.',
  },
  errBadEmail: {
    en: 'That email address is not valid.',
    ms: 'Alamat e-mel itu tidak sah.',
  },
} as const

export type UIKey = keyof typeof UI

export function tr(key: UIKey, locale: Locale): string {
  return UI[key][locale]
}
