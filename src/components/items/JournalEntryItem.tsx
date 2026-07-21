import type { JournalEntryItem as JournalEntryItemType } from '../../content/types'
import type { JournalResponse } from '../../grading/grade'
import { DoubleEntryBuilder } from './DoubleEntryBuilder'
import type { ItemProps } from './shared'

export function JournalEntryItem({ item, locale, graded, lastResponse, onSubmit }: ItemProps) {
  const it = item as JournalEntryItemType
  return (
    <DoubleEntryBuilder
      accounts={it.data.accounts}
      accountsMs={it.data.accounts_ms}
      answer={it.answer}
      graded={graded}
      lastResponse={lastResponse as JournalResponse | null}
      onSubmit={onSubmit}
      locale={locale}
    />
  )
}
