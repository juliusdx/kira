import { ITEM_RENDERERS } from '../../items/renderers'
import type { ItemProps } from './shared'

/** Dispatch to the renderer registered for the item's interaction type. */
export function ItemRenderer(props: ItemProps) {
  const Render = ITEM_RENDERERS[props.item.type]
  return <Render {...props} />
}
