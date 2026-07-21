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
import { PLACEHOLDER_TACCOUNT } from './placeholder_taccount'

const bundle = rawSeed as unknown as ContentBundle

// Merge in placeholder T-account content (see placeholder_taccount.ts).
const TOPICS: Topic[] = [...bundle.topics, PLACEHOLDER_TACCOUNT].sort(
  (a, b) => a.order - b.order,
)

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
  'Trade Payables': 'Pemiutang Perdagangan',
  'Trade Receivables': 'Penghutang Perdagangan',
}

export function accountMs(account: string): string {
  return ACCOUNT_GLOSSARY_MS[account] ?? account
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
