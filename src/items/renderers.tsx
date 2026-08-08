import type { ItemType } from '../content/types'
import type { ItemProps } from '../components/items/shared'
import { ChoiceItem } from '../components/items/ChoiceItem'
import { NumericItem } from '../components/items/NumericItem'
import { JournalEntryItem } from '../components/items/JournalEntryItem'
import { SpotErrorItem } from '../components/items/SpotErrorItem'
import { TAccountItem } from '../components/items/TAccountItem'
import { StatementBuildItem } from '../components/items/StatementBuildItem'
import { FadedStepItem } from '../components/items/FadedStepItem'

/**
 * The item-type registry — the UI half.
 *
 * Kept apart from `logic.ts` on purpose. `grade()` is imported by the session
 * queue, the scheduler and the sync layer; none of them should pull a React
 * component tree in behind it. Splitting the registry keeps the pure grading
 * layer pure, which is the property the whole test suite rests on.
 */
export type ItemRendererFn = (props: ItemProps) => React.ReactNode

export const ITEM_RENDERERS: Record<ItemType, ItemRendererFn> = {
  classify: ChoiceItem,
  debit_credit: ChoiceItem,
  numeric: NumericItem,
  journal_entry: JournalEntryItem,
  spot_error: SpotErrorItem,
  t_account: TAccountItem,
  statement_build: StatementBuildItem,
  faded_step: FadedStepItem,
}
