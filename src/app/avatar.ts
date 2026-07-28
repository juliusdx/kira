// A learner's face. Deliberately an emoji rather than an uploaded photo: no
// storage, no moderation, no privacy question about a child's picture sitting
// in a database, and it renders identically on every device.
//
// Everyone HAS one from the moment they exist, derived from their user id, so
// the leaderboard and the roster are never a wall of identical blanks. Picking
// a different one is a preference layered on top, not a prerequisite.

export const AVATARS = [
  '🦊', '🐼', '🦉', '🐬', '🦁', '🐢', '🦋', '🐝',
  '🦄', '🐙', '🐧', '🦜', '🐳', '🦔', '🐨', '🐸',
] as const

export type AvatarEmoji = (typeof AVATARS)[number]

/** Background tints, paired by index so a face keeps a stable colour. */
export const AVATAR_TONES = [
  'bg-rose-100 dark:bg-rose-500/20',
  'bg-amber-100 dark:bg-amber-500/20',
  'bg-lime-100 dark:bg-lime-500/20',
  'bg-emerald-100 dark:bg-emerald-500/20',
  'bg-teal-100 dark:bg-teal-500/20',
  'bg-sky-100 dark:bg-sky-500/20',
  'bg-indigo-100 dark:bg-indigo-500/20',
  'bg-fuchsia-100 dark:bg-fuchsia-500/20',
] as const

/** FNV-1a — small, stable, and identical across devices and reloads. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export interface AvatarLook {
  emoji: string
  tone: string
}

/**
 * The face to draw for someone. `chosen` wins when the learner has picked one;
 * otherwise it is derived from the seed (their user id), so it is stable and
 * the same on every device showing them.
 */
export function avatarFor(seed: string | null | undefined, chosen?: string | null): AvatarLook {
  const h = hashSeed(seed ?? '')
  const emoji =
    chosen && AVATARS.includes(chosen as AvatarEmoji)
      ? chosen
      : AVATARS[h % AVATARS.length]
  // Tone follows the emoji, not the seed, so a picked face looks deliberate
  // rather than randomly coloured.
  const idx = AVATARS.indexOf(emoji as AvatarEmoji)
  return {
    emoji,
    tone: AVATAR_TONES[(idx >= 0 ? idx : h) % AVATAR_TONES.length],
  }
}
