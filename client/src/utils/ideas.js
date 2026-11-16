// H13: sixty task ideas a parent can start from, ten per category, each for ages 8 to 10 or 11 to 14. Picking one only fills the
// task form; nothing about it is stored. Every word passes the server's screening (rule 8): ideas.check.js holds that.

const idea = (id, category, ages, title, instructions, doneLooksLike, points) => ({ id, category, ages, title, instructions, doneLooksLike, points })

export const IDEAS = [
  idea('chores-1', 'chores', '8-10', 'Make your bed', 'Straighten the sheet, shake the pillow and fold the blanket.', 'A photo of the bed, neat and flat.', 10),
  idea('chores-2', 'chores', '8-10', 'Water the plants', 'Give each plant a cup of water. Check the soil first.', 'A photo of the wet soil in each pot.', 10),
  idea('chores-3', 'chores', '8-10', 'Set the table', 'Plates, glasses and spoons for everyone before dinner.', 'A photo of the table, ready to eat.', 10),
  idea('chores-4', 'chores', '8-10', 'Sort the shoes', 'Put every pair of shoes by the door in its place, in pairs.', 'A photo of the shoe rack, every pair together.', 10),
  idea('chores-5', 'chores', '8-10', 'Fold your clothes', 'Fold the clean clothes on your bed and put them away.', 'A photo of the shelf with the folded clothes.', 15),
  idea('chores-6', 'chores', '11-14', 'Wash the dishes', 'Wash, rinse and stack the dinner dishes to dry.', 'A photo of the clean dishes on the rack.', 20),
  idea('chores-7', 'chores', '11-14', 'Sweep the kitchen', 'Sweep under the table and the corners, then empty the pan.', 'A photo of the clean floor.', 20),
  idea('chores-8', 'chores', '11-14', 'Take out the rubbish', 'Tie the bags, take them out and put in fresh ones.', 'A photo of the empty bin with a new bag.', 15),
  idea('chores-9', 'chores', '11-14', 'Clean your desk', 'Clear it, wipe it and put back only what you use.', 'A photo of the tidy desk.', 15),
  idea('chores-10', 'chores', '11-14', 'Help cook dinner', 'Wash and chop the vegetables for one dish, with a grown-up near.', 'A photo of the chopped vegetables.', 25),

  idea('study-1', 'study', '8-10', 'Times table practice', 'Say the 7 times table out loud twice, then write it down.', 'A photo of the table you wrote.', 15),
  idea('study-2', 'study', '8-10', 'Spelling words', 'Practise this week’s spelling words: look, cover, write, check.', 'A photo of the page with each word written three times.', 15),
  idea('study-3', 'study', '8-10', 'Ten sums', 'Do ten addition and subtraction sums from your book.', 'A photo of the ten sums with answers.', 15),
  idea('study-4', 'study', '8-10', 'Learn five new words', 'Find five new words in a book and write what each means.', 'A photo of the five words and meanings.', 15),
  idea('study-5', 'study', '8-10', 'Pack your school bag', 'Check the timetable and pack the books for tomorrow.', 'A photo of the packed bag, open.', 10),
  idea('study-6', 'study', '11-14', 'Revise one chapter', 'Read one science chapter and write five key points.', 'A photo of your five points.', 25),
  idea('study-7', 'study', '11-14', 'Practice paper', 'Do one page of maths practice without looking at the answers.', 'A photo of the finished page.', 25),
  idea('study-8', 'study', '11-14', 'Make flashcards', 'Make ten flashcards for the topic you find hardest.', 'A photo of the ten cards.', 20),
  idea('study-9', 'study', '11-14', 'Plan your week', 'Write down every homework due this week and when you will do it.', 'A photo of your plan.', 15),
  idea('study-10', 'study', '11-14', 'Teach it back', 'Explain one thing you learnt today to someone at home.', 'A short video of you explaining it.', 20),

  idea('reading-1', 'reading', '8-10', 'Read for 20 minutes', 'Read any book you like for 20 minutes.', 'A photo of the page where you stopped.', 15),
  idea('reading-2', 'reading', '8-10', 'Read aloud', 'Read two pages aloud to someone at home.', 'A short video of you reading.', 15),
  idea('reading-3', 'reading', '8-10', 'Draw the story', 'Draw your favourite part of the book you are reading.', 'A photo of your drawing.', 15),
  idea('reading-4', 'reading', '8-10', 'Library visit', 'Choose one new book from the library or the shelf at home.', 'A photo of the book you chose.', 10),
  idea('reading-5', 'reading', '8-10', 'Three new words', 'Find three words you did not know and ask what they mean.', 'A photo of the words, written down.', 10),
  idea('reading-6', 'reading', '11-14', 'Finish a chapter', 'Read to the end of the chapter you are on.', 'A note on what happened in the chapter.', 20),
  idea('reading-7', 'reading', '11-14', 'Write a review', 'Write five sentences about a book you finished: what you liked and why.', 'A photo of your review.', 25),
  idea('reading-8', 'reading', '11-14', 'Read the news', 'Read one news story for young readers and say what it was about.', 'A note with the story in your own words.', 15),
  idea('reading-9', 'reading', '11-14', 'Poem a day', 'Read a poem and copy out your favourite lines.', 'A photo of the lines you copied.', 15),
  idea('reading-10', 'reading', '11-14', 'Read in another language', 'Read one page in Hindi or another language you are learning.', 'A short video of you reading it.', 20),

  idea('creative-1', 'creative', '8-10', 'Draw your family', 'Draw everyone who lives at home, pets too.', 'A photo of your drawing.', 15),
  idea('creative-2', 'creative', '8-10', 'Build with blocks', 'Build a tower or a house with blocks or boxes.', 'A photo of what you built.', 15),
  idea('creative-3', 'creative', '8-10', 'Make a card', 'Make a card for someone you love.', 'A photo of the card, front and inside.', 15),
  idea('creative-4', 'creative', '8-10', 'Clay animal', 'Make an animal out of clay or dough.', 'A photo of your animal.', 15),
  idea('creative-5', 'creative', '8-10', 'Sing a song', 'Learn the words of a song and sing it all the way through.', 'A short video of you singing.', 15),
  idea('creative-6', 'creative', '11-14', 'Write a short story', 'Write a story of at least half a page with a beginning, a middle and an end.', 'A photo of your story.', 25),
  idea('creative-7', 'creative', '11-14', 'Practise an instrument', 'Practise your instrument for 20 minutes.', 'A short video of one piece you played.', 20),
  idea('creative-8', 'creative', '11-14', 'Paint a view', 'Paint or draw the view from a window.', 'A photo of your painting.', 20),
  idea('creative-9', 'creative', '11-14', 'Design a poster', 'Make a poster about something you care about.', 'A photo of the poster.', 20),
  idea('creative-10', 'creative', '11-14', 'Make a comic', 'Draw a comic strip of at least four boxes.', 'A photo of your comic.', 25),

  idea('outdoors-1', 'outdoors', '8-10', 'Play outside', 'Play outside for 30 minutes: run, skip or play a game.', 'A photo of where you played.', 15),
  idea('outdoors-2', 'outdoors', '8-10', 'Leaf hunt', 'Find five different leaves and lay them out.', 'A photo of the five leaves.', 10),
  idea('outdoors-3', 'outdoors', '8-10', 'Water the garden', 'Water the garden or the balcony plants with a grown-up.', 'A photo of the wet plants.', 10),
  idea('outdoors-4', 'outdoors', '8-10', 'Bird watch', 'Watch the birds for ten minutes and count how many you see.', 'A note with how many you counted.', 10),
  idea('outdoors-5', 'outdoors', '8-10', 'Chalk drawing', 'Draw a picture with chalk outside, where you are allowed.', 'A photo of your drawing.', 15),
  idea('outdoors-6', 'outdoors', '11-14', 'Cycle ride', 'Ride your bicycle for 20 minutes on a safe route you have agreed.', 'A photo at the end of your ride.', 20),
  idea('outdoors-7', 'outdoors', '11-14', 'Walk the long way', 'Go for a 30 minute walk with someone from home.', 'A photo from your walk.', 15),
  idea('outdoors-8', 'outdoors', '11-14', 'Plant a seed', 'Plant a seed in a pot and water it.', 'A photo of the pot with soil and a label.', 20),
  idea('outdoors-9', 'outdoors', '11-14', 'Play a team game', 'Play cricket, football or another team game for 30 minutes.', 'A photo of the game or the ground.', 20),
  idea('outdoors-10', 'outdoors', '11-14', 'Nature photo', 'Take three photos of interesting things in nature.', 'The three photos.', 15),

  idea('health-1', 'health', '8-10', 'Brush your teeth', 'Brush for two minutes, morning and night.', 'A note when both are done.', 10),
  idea('health-2', 'health', '8-10', 'Drink water', 'Drink six glasses of water through the day.', 'A note when you reach six.', 10),
  idea('health-3', 'health', '8-10', 'Eat a fruit', 'Eat one whole fruit after school.', 'A photo of the fruit before you eat it.', 10),
  idea('health-4', 'health', '8-10', 'Stretch', 'Do five stretches, holding each one for ten slow counts.', 'A short video of one stretch.', 10),
  idea('health-5', 'health', '8-10', 'Bedtime on time', 'Be in bed by your bedtime, lights off.', 'A note from you in the morning.', 15),
  idea('health-6', 'health', '11-14', 'Yoga or exercise', 'Do 15 minutes of yoga or exercise.', 'A short video of one part.', 20),
  idea('health-7', 'health', '11-14', 'Screen-free hour', 'Spend an hour before bed without a screen.', 'A note on what you did instead.', 20),
  idea('health-8', 'health', '11-14', 'Pack a healthy snack', 'Pack a snack for school with a fruit or a vegetable in it.', 'A photo of the snack box.', 15),
  idea('health-9', 'health', '11-14', 'Skipping', 'Skip with a rope 100 times, in as many goes as you need.', 'A short video of you skipping.', 20),
  idea('health-10', 'health', '11-14', 'Breathe and rest', 'Sit quietly for five minutes and breathe slowly.', 'A note on how you felt after.', 15),
]

/** K6: the idea with this id, or undefined when the app no longer has it (a child's suggestion can outlive an idea). */
export const ideaOf = (id) => IDEAS.find((i) => i.id === id)

/** The words for a suggestion's idea (K6): its title in quotes, or "an idea from the list" when the app no longer has it. */
export const ideaWords = (ideaId) => {
  const idea = ideaOf(ideaId)
  return idea ? `“${idea.title}”` : 'an idea from the list'
}

/** The age bands, as the picker shows them. */
export const AGES = { '8-10': 'Ages 8 to 10', '11-14': 'Ages 11 to 14' }
