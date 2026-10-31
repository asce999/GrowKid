import { BicepsFlexed, HandHeart, Heart, Lightbulb, Mountain, Sparkles } from 'lucide-react'

/** The six cheers a parent can add to an approval (DESIGN.md section 8). The server owns the kinds. */
export const CHEERS = {
  proud: { words: 'Proud of you', Icon: Heart },
  tidy: { words: 'Super tidy', Icon: Sparkles },
  brave: { words: 'That was brave', Icon: Mountain },
  clever: { words: 'Clever thinking', Icon: Lightbulb },
  kind: { words: 'So kind', Icon: HandHeart },
  effort: { words: 'Great effort', Icon: BicepsFlexed },
}
