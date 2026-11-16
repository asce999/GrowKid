import { Check, Flame, Sprout, Star } from 'lucide-react'
import { categoryOf } from './categories.js'

/** The icon on each shape of sticker (DESIGN.md section 10). The shape says what kind it is. */
export const STICKER_ICONS = { seal: Check, shield: Flame, hexagon: Sprout, star: Star }

/** What each measure counts, for "7 of 10 tasks approved". */
export const MEASURE_WORDS = {
  approved: 'tasks approved',
  streak: 'days in your best streak',
  level: 'levels',
  kinds: 'kinds of task',
  firstTry: 'tasks right first time',
  quests: 'weekly quests completed',
  // K8: the six kind stickers count their kind's tasks
  chores: 'chores tasks approved',
  study: 'study tasks approved',
  reading: 'reading tasks approved',
  creative: 'music and art tasks approved',
  outdoors: 'outdoors tasks approved',
  health: 'health tasks approved',
}

/** The icon a sticker carries: its shape's, or for a kind sticker (K8) its kind's own icon from DESIGN.md section 8. */
export const iconOf = (sticker) => (sticker.kind ? categoryOf(sticker.kind).Icon : STICKER_ICONS[sticker.shape])

/** How far each sticker in a row is turned, so a chart looks stuck on by hand. */
export const tiltOf = (i) => [-6, 4, -3, 5, -4, 3][i % 6]

/** A sticker counts as earned for a page once its approval has been seen on Today. */
export const isEarned = (sticker) => Boolean(sticker.earnedAt && sticker.seen)
