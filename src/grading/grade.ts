import type { Item } from '../content/types'
import { ITEM_LOGIC } from '../items/logic'
import type { Response } from './graders'

// The grading entry point.
//
// The per-type graders and the response shapes now live in `graders.ts`, and
// which grader belongs to which type is declared in `items/logic.ts`. This
// file is the seam those two meet at, and it re-exports the helpers so the
// ~9 modules that import from here did not have to move.

export * from './graders'

export function grade(item: Item, response: Response): boolean {
  return ITEM_LOGIC[item.type].grade(item, response)
}
