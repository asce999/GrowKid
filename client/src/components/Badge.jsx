import { createElement } from 'react'
import { initialOf } from '../utils/format.js'
import { iconOf } from '../utils/stickers.js'

/**
 * K10: a person's round mark. A child who picked a badge shows it, a sticker's icon on their colour; anyone else shows the
 * first letter of their name, as before. Decorative: the name is always written beside it or on the control holding it.
 */
export default function Badge({ avatar, name, className = '' }) {
  if (!avatar) {
    return (
      <span className={`avatar ${className}`} aria-hidden="true">
        {initialOf(name)}
      </span>
    )
  }
  return (
    <span className={`avatar badge-${avatar.colour} ${className}`} aria-hidden="true">
      {createElement(iconOf(avatar), { className: 'size-1/2' })}
    </span>
  )
}
