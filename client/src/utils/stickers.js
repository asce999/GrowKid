import { Check, Flame, Sprout, Star } from 'lucide-react'

/** The icon on each shape of sticker (DESIGN.md section 10). The shape says what kind it is. */
export const STICKER_ICONS = { seal: Check, shield: Flame, hexagon: Sprout, star: Star }

/** How far each sticker in a row is turned, so a chart looks stuck on by hand. */
export const tiltOf = (i) => [-6, 4, -3, 5, -4, 3][i % 6]

/** A sticker counts as earned for a page once its approval has been seen on Today. */
export const isEarned = (sticker) => Boolean(sticker.earnedAt && sticker.seen)
