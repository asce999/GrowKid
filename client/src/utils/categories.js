import { Apple, Bike, BookOpen, Brush, Palette, Pencil } from 'lucide-react'

/** The six task categories (DESIGN.md section 8). A category is an icon and a name, never a colour. */
export const CATEGORIES = [
  { id: 'chores', name: 'Chores', Icon: Brush },
  { id: 'study', name: 'Study', Icon: Pencil },
  { id: 'reading', name: 'Reading', Icon: BookOpen },
  { id: 'creative', name: 'Music and art', Icon: Palette },
  { id: 'outdoors', name: 'Outdoors', Icon: Bike },
  { id: 'health', name: 'Health', Icon: Apple },
]

export const categoryOf = (id) => CATEGORIES.find((category) => category.id === id)
