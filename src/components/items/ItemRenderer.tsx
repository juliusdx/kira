import { ChoiceItem } from './ChoiceItem'
import { NumericItem } from './NumericItem'
import { JournalEntryItem } from './JournalEntryItem'
import { SpotErrorItem } from './SpotErrorItem'
import { TAccountItem } from './TAccountItem'
import type { ItemProps } from './shared'

/** Dispatch to the renderer for the item's interaction type. */
export function ItemRenderer(props: ItemProps) {
  switch (props.item.type) {
    case 'classify':
    case 'debit_credit':
      return <ChoiceItem {...props} />
    case 'numeric':
      return <NumericItem {...props} />
    case 'journal_entry':
      return <JournalEntryItem {...props} />
    case 'spot_error':
      return <SpotErrorItem {...props} />
    case 't_account':
      return <TAccountItem {...props} />
  }
}
