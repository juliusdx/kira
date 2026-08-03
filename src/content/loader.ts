import type {
  ContentBundle,
  Item,
  ItemIndexEntry,
  Lesson,
  Locale,
  LocalizedText,
  Topic,
} from './types'
// Julius's authored bank lives at the project root as the single source of
// truth. The loader imports it directly so porting Stage 3–4 is a file edit.
import rawSeed from '../../seed_content.json'

const bundle = rawSeed as unknown as ContentBundle

const TOPICS: Topic[] = [...bundle.topics].sort((a, b) => a.order - b.order)

export const CONTENT: ContentBundle = { meta: bundle.meta, topics: TOPICS }

// --- Flat index ------------------------------------------------------------
const index = new Map<string, ItemIndexEntry>()
{
  let order = 0
  for (const topic of TOPICS) {
    for (const lesson of [...topic.lessons].sort((a, b) => a.order - b.order)) {
      for (const item of lesson.items) {
        index.set(item.id, {
          item,
          topicId: topic.id,
          lessonId: lesson.id,
          order: order++,
        })
      }
    }
  }
}

/** Development-time sanity check — surfaces malformed content early. */
function validate(): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const [id, entry] of index) {
    if (seen.has(id)) errors.push(`duplicate item id: ${id}`)
    seen.add(id)
    const it = entry.item
    if (!it.prompt?.en || !it.prompt?.ms)
      errors.push(`${id}: missing prompt en/ms`)
    if (!it.explanation?.en || !it.explanation?.ms)
      errors.push(`${id}: missing explanation en/ms`)
    if (it.type === 'classify' || it.type === 'debit_credit') {
      if (!it.data.options?.includes(it.answer))
        errors.push(`${id}: answer "${it.answer}" not in options`)
    }
  }
  return errors
}

if (import.meta.env?.DEV) {
  const errs = validate()
  if (errs.length) console.warn('[content] validation issues:\n' + errs.join('\n'))
}

export const ALL_ENTRIES: ItemIndexEntry[] = [...index.values()].sort(
  (a, b) => a.order - b.order,
)
export const ALL_ITEMS: Item[] = ALL_ENTRIES.map((e) => e.item)

export function getEntry(id: string): ItemIndexEntry | undefined {
  return index.get(id)
}
export function getItem(id: string): Item | undefined {
  return index.get(id)?.item
}

export const TOTAL_ITEMS = ALL_ENTRIES.length

// --- Localization helpers --------------------------------------------------
export function t(text: LocalizedText | undefined, locale: Locale): string {
  if (!text) return ''
  return text[locale] ?? text.en
}

/**
 * Localized option labels for a choice item, keeping alignment with the
 * canonical English `options` array (the answer space).
 */
export function localizedOptions(
  options: string[],
  optionsMs: string[] | undefined,
  locale: Locale,
): { value: string; label: string }[] {
  return options.map((value, i) => ({
    value,
    label: locale === 'ms' && optionsMs?.[i] ? optionsMs[i] : value,
  }))
}

/**
 * Fallback EN→BM account glossary, used where content doesn't carry an
 * `accounts_ms` array (e.g. spot_error items). Content-provided labels always
 * take precedence over this.
 */
export const ACCOUNT_GLOSSARY_MS: Record<string, string> = {
  Cash: 'Tunai',
  Capital: 'Modal',
  Sales: 'Jualan',
  Wages: 'Gaji',
  Van: 'Van',
  Inventory: 'Inventori',
  Electricity: 'Elektrik',
  Printer: 'Pencetak',
  'Trade Payables': 'Akaun Belum Bayar',
  'Trade Receivables': 'Akaun Belum Terima',
  Bank: 'Bank',
  Purchases: 'Belian',
  Rent: 'Sewa',
  Drawings: 'Ambilan',
  Premises: 'Premis',
  'Motor Vehicles': 'Kenderaan Bermotor',
  'Bank Overdraft': 'Overdraf Bank',
  'Bank Loan': 'Pinjaman Bank',
  // Stage 5 — year-end adjustments
  'Rent Expense': 'Belanja Sewa',
  'Accrued Rent': 'Sewa Terakru',
  'Prepaid Rent': 'Sewa Prabayar',
  'Insurance Expense': 'Belanja Insurans',
  'Prepaid Insurance': 'Insurans Prabayar',
  'Accrued Insurance': 'Insurans Terakru',
  'Depreciation Expense': 'Belanja Susut Nilai',
  'Accumulated Depreciation': 'Susut Nilai Terkumpul',
  'Bad Debts': 'Hutang Lapuk',
  'Provision for Doubtful Debts': 'Peruntukan Hutang Ragu',
  // Stage 6 — control, checking and the specialised final accounts
  Suspense: 'Penyelesaian',
  'Sales Ledger Control': 'Kawalan Lejar Jualan',
  'Purchases Ledger Control': 'Kawalan Lejar Belian',
  'Returns Inwards': 'Pulangan Masuk',
  'Returns Outwards': 'Pulangan Keluar',
  'Discount Allowed': 'Diskaun Diberi',
  'Discount Received': 'Diskaun Diterima',
  Subscriptions: 'Yuran',
  'Accumulated Fund': 'Kumpulan Wang Terkumpul',
  'Current Account': 'Akaun Semasa',
  'Capital Account': 'Akaun Modal',
  'Office Equipment': 'Peralatan Pejabat',
}

export function accountMs(account: string): string {
  return ACCOUNT_GLOSSARY_MS[account] ?? account
}

/**
 * Tags that describe HOW a question is presented rather than anything a
 * learner can be weak at. They are excluded from the teacher's "weakest
 * skills" — telling a parent their child's weakness is "faded-step" is noise.
 */
export const MECHANIC_SKILL_TAGS = new Set(['faded-step'])

/**
 * Human, bilingual names for skill tags. The raw tags are kebab-case slugs
 * written for the author, not for a parent reading a progress card — and this
 * app is BM-first, so an English slug is doubly wrong on screen.
 */
export const SKILL_LABELS: Record<string, LocalizedText> = {
  equation: { en: 'The accounting equation', ms: 'Persamaan perakaunan' },
  classification: { en: 'Classifying accounts', ms: 'Mengelas akaun' },
  equity: { en: 'Equity', ms: 'Ekuiti' },
  inventory: { en: 'Inventory', ms: 'Inventori' },
  'debit-credit': { en: 'Debit & credit', ms: 'Debit & kredit' },
  'source-documents': { en: 'Source documents', ms: 'Dokumen sumber' },
  'books-of-first-entry': {
    en: 'Books of first entry',
    ms: 'Buku catatan pertama',
  },
  'petty-cash': { en: 'Petty cash & the imprest', ms: 'Tunai runcit & panjar' },
  'inventory-valuation': {
    en: 'Valuing closing inventory',
    ms: 'Menilai inventori akhir',
  },
  'double-entry': { en: 'Double entry', ms: 'Catatan bergu' },
  'credit-purchase': { en: 'Credit purchases', ms: 'Belian kredit' },
  receivable: { en: 'Receivables', ms: 'Akaun Belum Terima' },
  ledger: { en: 'Ledger & T-accounts', ms: 'Lejar & akaun T' },
  'balancing-off': { en: 'Balancing off an account', ms: 'Mengimbangkan akaun' },
  'trial-balance': { en: 'Trial balance', ms: 'Imbangan duga' },
  'income-statement': { en: 'Income statement', ms: 'Penyata pendapatan' },
  'financial-position': {
    en: 'Statement of financial position',
    ms: 'Penyata kedudukan kewangan',
  },
  'statement-placement': { en: 'Where a figure belongs', ms: 'Penempatan angka' },
  accruals: { en: 'Accruals', ms: 'Terakru' },
  prepayments: { en: 'Prepayments', ms: 'Prabayar' },
  depreciation: { en: 'Depreciation', ms: 'Susut nilai' },
  'reducing-balance': {
    en: 'Reducing balance depreciation',
    ms: 'Susut nilai baki berkurangan',
  },
  disposal: { en: 'Disposal of an asset', ms: 'Pelupusan aset' },
  'revaluation-method': {
    en: 'Depreciation by revaluation',
    ms: 'Susut nilai secara penilaian semula',
  },
  dissolution: {
    en: 'Dissolving a partnership',
    ms: 'Membubarkan perkongsian',
  },
  'break-even': { en: 'Break-even point', ms: 'Titik pulang modal' },
  'bad-debts': { en: 'Bad debts', ms: 'Hutang lapuk' },
  provision: {
    en: 'Provision for doubtful debts',
    ms: 'Peruntukan hutang ragu',
  },
  'bank-reconciliation': { en: 'Bank reconciliation', ms: 'Penyesuaian bank' },
  'control-accounts': { en: 'Control accounts', ms: 'Akaun kawalan' },
  'error-types': { en: 'Types of error', ms: 'Jenis kesilapan' },
  suspense: { en: 'Suspense account', ms: 'Akaun penyelesaian' },
  'incomplete-records': { en: 'Incomplete records', ms: 'Rekod tak lengkap' },
  'club-accounts': { en: 'Club accounts', ms: 'Akaun kelab' },
  subscriptions: { en: 'Subscriptions', ms: 'Yuran' },
  partnership: { en: 'Partnership', ms: 'Perkongsian' },
  appropriation: { en: 'Profit appropriation', ms: 'Pengasingan untung rugi' },
  // Stage 7
  'company-accounts': { en: 'Limited company accounts', ms: 'Akaun syarikat berhad' },
  'share-capital': { en: 'Share capital', ms: 'Modal Syer' },
  dividends: { en: 'Dividends', ms: 'Dividen' },
  manufacturing: { en: 'Manufacturing accounts', ms: 'Akaun pengilangan' },
  'cost-of-production': { en: 'Cost of production', ms: 'Kos pengeluaran' },
  'ratio-analysis': { en: 'Ratio analysis', ms: 'Analisis nisbah' },
  profitability: { en: 'Profitability', ms: 'Keberuntungan' },
  liquidity: { en: 'Liquidity', ms: 'Kecairan' },
  'cash-budget': { en: 'Cash budget', ms: 'Belanjawan tunai' },
  'faded-step': { en: 'Faded workings', ms: 'Kerja kira dilunturkan' },
}

/** Readable name for a skill tag, falling back to the slug de-kebabed. */
export function skillLabel(tag: string, locale: Locale): string {
  const label = SKILL_LABELS[tag]
  if (label) return t(label, locale)
  return tag.replace(/-/g, ' ')
}

/** Localized label for a single account (English canonical -> display). */
export function localizedAccount(
  account: string,
  accounts: string[] | undefined,
  accountsMs: string[] | undefined,
  locale: Locale,
): string {
  if (locale !== 'ms' || !accounts || !accountsMs) return account
  const i = accounts.indexOf(account)
  return i >= 0 && accountsMs[i] ? accountsMs[i] : account
}

/** Topic lookup for a given item id (used by the progress view). */
export function topicOf(itemId: string): Topic | undefined {
  const entry = index.get(itemId)
  if (!entry) return undefined
  return TOPICS.find((tp) => tp.id === entry.topicId)
}

export function lessonOf(itemId: string): Lesson | undefined {
  const entry = index.get(itemId)
  if (!entry) return undefined
  const topic = TOPICS.find((tp) => tp.id === entry.topicId)
  return topic?.lessons.find((l) => l.id === entry.lessonId)
}
