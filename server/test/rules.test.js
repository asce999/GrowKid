import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, text as typed } from '../src/errors.js'
import { sniff, strip } from '../src/files.js'
import { checkQuest, checkTask, dayKeyIn, growthForChild, growthOf, isDay, leaderboardOf, matchesWord, progressOf, recentRest, screen, stickerList } from '../src/rules.js'
import { dayKey, progress, score, weekKey } from '../src/scoring.js'
import { itemOf } from '../src/shape.js'
import { SECRET, box, brokenJpeg, chunk, jpeg, location, mp4, pdf, png, routeTrack, segment, text, track, webm, webp, withRoute } from './fixtures.js'

const refusedAs = (code) => (error) => error instanceof ApiError && error.code === code
const has = (buffer, what) => buffer.includes(what)

// ------------------------------------------------------------------ files

test('sniff decides the type from the first bytes, and a text file called .png or a PDF (C2) is nothing', () => {
  assert.equal(sniff(jpeg()), 'image/jpeg')
  assert.equal(sniff(png()), 'image/png')
  assert.equal(sniff(webp()), 'image/webp')
  assert.equal(sniff(pdf()), null)
  assert.equal(sniff(mp4()), 'video/mp4')
  assert.equal(sniff(mp4([], 'qt')), 'video/quicktime')
  assert.equal(sniff(webm()), 'video/webm')
  assert.equal(sniff(text()), null)
  assert.equal(sniff(Buffer.alloc(0)), null)
  assert.equal(sniff(Buffer.from('RIFF....WAVE')), null) // RIFF, but not WebP
})

test('JPEG: EXIF, XMP, IPTC and comments go; the colour profile and the picture stay; a rotation is put back on its own', () => {
  const stored = strip(jpeg(6), 'image/jpeg')
  assert.equal(has(stored, SECRET), false)
  assert.equal(has(stored, Buffer.from([0x25, 0x88])), false) // no GPS tag
  for (const kept of ['JFIF', 'ICC_PROFILE', 'SCANDATA']) assert.equal(has(stored, kept), true)
  const at = stored.indexOf('Exif\0\0')
  assert.equal(stored.indexOf('Exif', at + 1), -1) // one EXIF segment, and it holds only the rotation
  const tiff = at + 6
  assert.deepEqual([stored.readUInt16LE(tiff + 8), stored.readUInt16LE(tiff + 10), stored.readUInt16LE(tiff + 18)], [1, 0x0112, 6])
  assert.equal(stored.readUInt16BE(at - 2), 34) // the segment's own length field
  assert.deepEqual([...stored.subarray(0, 2)], [0xff, 0xd8])
  assert.deepEqual([...stored.subarray(-2)], [0xff, 0xd9])
})

test('JPEG: no rotation, or an EXIF that does not parse, leaves no EXIF segment at all', () => {
  assert.equal(has(strip(jpeg(1), 'image/jpeg'), 'Exif'), false)
  assert.equal(has(strip(jpeg(9), 'image/jpeg'), 'Exif'), false) // not one of the eight orientations
  const garbled = jpeg(6)
  garbled.fill(0xff, garbled.indexOf('II') + 4, garbled.indexOf('II') + 8) // the IFD offset now points far outside the segment
  const stored = strip(garbled, 'image/jpeg')
  assert.equal(has(stored, 'Exif'), false)
  assert.equal(has(stored, SECRET), false)
})

test('a file whose structure does not parse is FILE_TYPE, so nothing is stored with its details', () => {
  const bad = refusedAs('FILE_TYPE')
  assert.throws(() => strip(brokenJpeg(), 'image/jpeg'), bad)
  assert.throws(() => strip(jpeg().subarray(0, 40), 'image/jpeg'), bad) // ends before the scan
  assert.throws(() => strip(png().subarray(0, 60), 'image/png'), bad) // ends before IEND
  assert.throws(() => strip(Buffer.concat([Buffer.from('89504e47', 'hex'), text()]), 'image/png'), bad) // PNG magic, not a PNG
  assert.throws(() => strip(webp().subarray(0, 40), 'image/webp'), bad)
  assert.throws(() => strip(mp4([]).subarray(0, 30), 'video/mp4'), bad) // a box that runs past the end
  assert.throws(() => strip(Buffer.concat([box('ftyp', Buffer.from('isom0000isom')), box('mdat', Buffer.from('x'))]), 'video/mp4'), bad) // no moov
})

test('PNG: eXIf and the text chunks go, everything else stays', () => {
  const dirty = png(chunk('eXIf', Buffer.from(SECRET)), chunk('tEXt', Buffer.from(`Comment\0${SECRET}`)), chunk('zTXt', Buffer.from(SECRET)), chunk('iTXt', Buffer.from(SECRET)))
  const stored = strip(dirty, 'image/png')
  assert.deepEqual(stored, png()) // exactly the clean PNG again
  assert.ok(stored.length < dirty.length)
})

test('WebP: EXIF and XMP go, their flags are cleared and the RIFF size is right', () => {
  const stored = strip(webp(), 'image/webp')
  assert.equal(has(stored, SECRET), false)
  for (const gone of ['EXIF', 'XMP ']) assert.equal(has(stored, gone), false)
  assert.equal(has(stored, 'VP8L'), true)
  assert.equal(stored.readUInt32LE(4), stored.length - 8)
  assert.equal(stored[stored.indexOf('VP8X') + 8], 0x20) // the colour profile flag stays
})

test('MP4 and QuickTime: udta and meta inside moov become free boxes, blanked, at the same size', () => {
  for (const original of [mp4(), mp4([location(), box('meta', Buffer.from(SECRET))], 'qt')]) {
    const stored = strip(original, sniff(original))
    assert.equal(stored.length, original.length)
    assert.equal(has(stored, SECRET), false)
    assert.equal(has(stored, 'udta'), false)
    assert.equal(has(stored, 'meta'), false)
    assert.equal(has(stored, 'free'), true)
    assert.equal(has(stored, 'mvhd'), true) // the rest of moov is untouched
    assert.equal(has(stored, 'frames'), true)
  }
})

test('MP4: a 64-bit box size and a last box of size 0 (to the end of the file) are read', () => {
  const head = Buffer.alloc(16)
  head.writeUInt32BE(1) // size 1: the real size follows the type
  head.write('moov', 4, 'latin1')
  const inside = Buffer.concat([track(), box('udta', Buffer.from(SECRET))])
  head.writeBigUInt64BE(BigInt(16 + inside.length), 8)
  const lastBox = Buffer.concat([Buffer.alloc(4), Buffer.from('mdat'), Buffer.from('to the end')]) // size 0
  const original = Buffer.concat([box('ftyp', Buffer.from('isom0000isom')), head, inside, lastBox])
  const stored = strip(original, 'video/mp4')
  assert.equal(stored.length, original.length)
  assert.equal(has(stored, SECRET), false)
  assert.equal(has(stored, 'to the end'), true)
})

test('JPEG: the stored file ends at the first EOI, so a second picture or a video after it is dropped, EXIF and GPS with it', () => {
  const first = strip(jpeg(1), 'image/jpeg')
  const second = strip(Buffer.concat([jpeg(1), jpeg(6)]), 'image/jpeg') // a second picture whose EXIF holds a GPS block
  assert.equal(second.equals(first), true)
  assert.equal(has(second, SECRET), false)
  assert.equal(strip(Buffer.concat([jpeg(6), mp4()]), 'image/jpeg').equals(strip(jpeg(6), 'image/jpeg')), true) // a Motion Photo's video
  assert.deepEqual([...first.subarray(-2)], [0xff, 0xd9])
})

test('JPEG: coded data is walked marker by marker, so metadata between the scans of a progressive picture goes too', () => {
  const scan = (extra = []) =>
    Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      segment(0xdb, 'quant'),
      Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
      Buffer.from([0x41, 0xff, 0x00, 0x42, 0xff, 0xd0, 0x43, 0xff]), // a stuffed FF00, a restart marker, and a fill FF before the next marker
      ...extra, // dropped between the scans: EXIF, a comment, IPTC
      segment(0xc4, 'huffman'),
      Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
      Buffer.from([0x44, 0xff, 0x00, 0x45]),
      Buffer.from([0xff, 0xd9]),
    ])
  const clean = scan()
  const dirty = Buffer.concat([scan([segment(0xe1, `Exif\0\0${SECRET}`), segment(0xfe, SECRET), segment(0xed, SECRET)]), Buffer.from(SECRET), jpeg(6)])
  assert.equal(strip(dirty, 'image/jpeg').equals(clean), true)
  assert.equal(strip(clean, 'image/jpeg').equals(clean), true)
})

test('JPEG: no EOI, or an EOI before any scan, is FILE_TYPE', () => {
  const whole = jpeg(1)
  assert.throws(() => strip(whole.subarray(0, whole.length - 2), 'image/jpeg'), refusedAs('FILE_TYPE'))
  assert.throws(() => strip(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg'), refusedAs('FILE_TYPE'))
})

test('MP4: udta, meta and uuid boxes at the top of the file are blanked too', () => {
  const original = Buffer.concat([mp4([]), location(), box('meta', Buffer.from(SECRET)), box('uuid', Buffer.from(`0123456789abcdef${SECRET}`))])
  const stored = strip(original, 'video/mp4')
  assert.equal(stored.length, original.length)
  assert.equal(has(stored, SECRET), false)
  for (const gone of ['udta', 'meta', 'uuid']) assert.equal(has(stored, gone), false)
  assert.equal(stored.toString('latin1').match(/free/g).length, 3)
  assert.equal(has(stored, 'frames'), true)
})

test('A5: a file is an MP4 or a QuickTime movie only if a track of it is video; sound and picture sequences are FILE_TYPE', () => {
  strip(mp4([]), 'video/mp4')
  strip(mp4([], 'qt'), 'video/quicktime')
  for (const [brand, handler] of [['M4A', 'soun'], ['avis', 'pict'], ['isom', 'vid ']]) {
    const original = mp4([], brand, handler)
    assert.throws(() => strip(original, sniff(original)), refusedAs('FILE_TYPE'))
  }
  const noTrack = Buffer.concat([box('ftyp', Buffer.from('isom0000isom')), box('moov', box('mvhd', Buffer.alloc(100))), box('mdat', Buffer.from('x'))])
  assert.throws(() => strip(noTrack, 'video/mp4'), refusedAs('FILE_TYPE'))
})

/** The types of moov's children, in order. */
const moovChildren = (stored) => {
  const at = stored.indexOf('moov') - 4
  const end = at + stored.readUInt32BE(at)
  const types = []
  for (let i = at + 8; i < end; i += stored.readUInt32BE(i)) types.push(stored.toString('latin1', i + 4, i + 8))
  return types
}

test('T7: a data track (meta, text, gpmd, sbtl or subt) loses its samples where they lie and becomes a free box; the picture stays and the size is the same', () => {
  for (const [handler, options] of [['meta', {}], ['gpmd', {}], ['text', {}], ['sbtl', {}], ['subt', {}], ['meta', { wide: true }], ['meta', { perChunk: 1 }]]) {
    const why = `${handler} ${JSON.stringify(options)}`
    const original = withRoute(handler, options)
    assert.equal(has(original, SECRET), true, why)
    const stored = strip(original, 'video/mp4')
    assert.equal(stored.length, original.length, why)
    assert.equal(has(stored, SECRET), false, why)
    assert.equal(has(stored, 'frames'), true, why)
    for (const gone of ['stsz', 'stco', 'co64']) assert.equal(has(stored, gone), false, `${why}: ${gone}`)
    assert.deepEqual(moovChildren(stored), ['mvhd', 'trak', 'free'], why)
  }
})

test('T7: a data track whose samples cannot be found is FILE_TYPE', () => {
  const size = 4096
  const flooded = Buffer.concat([
    box('ftyp', Buffer.from('isom'), Buffer.alloc(4), Buffer.from('isom')),
    box('moov', box('mvhd', Buffer.alloc(100)), track('vide'), routeTrack('meta', Array(50).fill(size - 10), Array(50).fill(0), { perChunk: 1 })),
    box('mdat', Buffer.alloc(size)),
  ])
  const unreadable = [
    withRoute('meta', { offsets: [0xfffffff0] }), // past the end of the file
    withRoute('meta', { tables: ['stsz', 'stsc'] }), // no chunk offsets
    withRoute('meta', { tables: ['stsc', 'stco'] }), // no sample sizes
    withRoute('meta', {}, [box('moof', Buffer.alloc(8))]), // fragmented: the table does not list every sample
    flooded, // 50 chunks that each claim nearly the whole file: the work is bounded by the file's own size
  ]
  for (const [i, original] of unreadable.entries()) assert.throws(() => strip(original, 'video/mp4'), refusedAs('FILE_TYPE'), `case ${i}`)
})

test('T7: a sample table claiming four billion samples of one size is refused at once, not walked', () => {
  const u32s = (...numbers) => Buffer.concat(numbers.map((n) => Buffer.from([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])))
  const most = 0xffffffff
  const stbl = box('stbl', box('stsz', u32s(0, 1, most)), box('stsc', u32s(0, 1, 1, most, 1)), box('stco', u32s(0, 1, 0)))
  const trak = box('trak', box('mdia', box('hdlr', Buffer.alloc(8), Buffer.from('gpmd'), Buffer.alloc(12)), box('minf', stbl)))
  const original = Buffer.concat([box('ftyp', Buffer.from('isom'), Buffer.alloc(4), Buffer.from('isom')), box('moov', box('mvhd', Buffer.alloc(100)), track('vide'), trak), box('mdat', Buffer.from('frames'))])
  const started = Date.now()
  assert.throws(() => strip(original, 'video/mp4'), refusedAs('FILE_TYPE'))
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started} ms`)
})

test('T7: a video with no data track is stored exactly as before', () => {
  const original = Buffer.concat([box('ftyp', Buffer.from('isom'), Buffer.alloc(4), Buffer.from('isom')), box('moov', box('mvhd', Buffer.alloc(100)), track('vide'), track('soun')), box('mdat', Buffer.from('frames'))])
  assert.equal(strip(original, 'video/mp4').equals(original), true)
})

test('text keeps what was typed: a NUL is removed, a lone surrogate becomes U+FFFD, a non-string is empty', () => {
  assert.deepEqual([typed('a\0b'), typed('\0\0'), typed('a\ud800b'), typed(5), typed(null), typed('plain 😀')], ['ab', '', 'a�b', '', '', 'plain 😀'])
})

test('a WebM is stored as sent', () => {
  assert.equal(strip(webm(), 'video/webm').equals(webm()), true)
})

test('C1: a file of more parts than the cap is FILE_TYPE: 10,000 JPEG segments, WebP chunks or MP4 boxes, 20,000 PNG chunks', () => {
  const many = (n, part) => Array.from({ length: n }, () => part)
  const jpegOf = (n) => Buffer.concat([Buffer.from([0xff, 0xd8]), ...many(n, segment(0xfe, '')), Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]), Buffer.from('SCAN'), Buffer.from([0xff, 0xd9])])
  const pngOf = (n) => png(...many(n, chunk('tEXt')))
  const webpOf = (n) => {
    const body = Buffer.concat([Buffer.from('WEBP'), ...many(n, Buffer.concat([Buffer.from('JUNK'), Buffer.alloc(4)]))])
    const size = Buffer.alloc(4)
    size.writeUInt32LE(body.length)
    return Buffer.concat([Buffer.from('RIFF'), size, body])
  }
  const mp4Of = (n) => mp4(many(n, box('free')))
  // under the cap they still parse; one walk counts every part (the scan's three and the frame markers included)
  strip(jpegOf(9_990), 'image/jpeg')
  strip(pngOf(19_990), 'image/png')
  strip(webpOf(9_999), 'image/webp')
  strip(mp4Of(9_990), 'video/mp4')
  for (const [bytes, type] of [[jpegOf(10_001), 'image/jpeg'], [pngOf(20_001), 'image/png'], [webpOf(10_001), 'image/webp'], [mp4Of(10_001), 'video/mp4']]) {
    assert.throws(() => strip(bytes, type), refusedAs('FILE_TYPE'), type)
  }
})

// ------------------------------------------------------------------ the task rules

test('screen (rule 8, A8): the three words, with a typographic apostrophe counted as a plain one, and only as whole words', () => {
  for (const words of ['Keep it SECRET', 'a dare for you', "don't tell mum", 'don’t tell mum']) {
    assert.throws(() => screen(words), (e) => e.code === 'SCREENED' && e.fields.word !== undefined)
  }
  assert.throws(() => screen('don’t tell'), (e) => e.fields.word === "don't tell")
  screen('The secretary dared to tell') // secretary, dared: not the words
  screen('secret2 and 9dare') // C7: a digit is part of the word
  assert.throws(() => screen('a dare_'), (e) => e.fields.word === 'dare')
  assert.throws(() => screen('ＳＥＣＲＥＴ'), (e) => e.fields.word === 'secret') // full-width letters, folded by NFKC
})

test('C7: matchesWord finds a whole word in any script, and a word holding regex characters means only itself', () => {
  assert.equal(matchesWord('a.b', 'say a.b now'), true)
  assert.equal(matchesWord('a.b', 'say axb now'), false) // the dot is a dot
  assert.equal(matchesWord('(x)', 'it is (x)'), true)
  assert.equal(matchesWord('c++', 'learn c++'), true)
  assert.equal(matchesWord('[a-z]', 'b'), false)
  // Devanagari: \b would find nothing here, because it knows only ASCII letters
  assert.equal(matchesWord('राज़', 'यह राज़ है'), true) // a word between spaces
  assert.equal(matchesWord('राज़', 'राज़'), true) // the whole text
  assert.equal(matchesWord('राज़', 'राज़दार'), false) // inside a longer word
  assert.equal(matchesWord('दार', 'राज़दार'), false) // the end of a longer word
  assert.equal(matchesWord('राज', 'राजा'), false) // a vowel sign after it is part of the word
  assert.equal(matchesWord("don't tell", 'DON’T TELL'), true)
  // invisible format characters would show the word and hide it: a soft hyphen, a zero-width space, a zero-width joiner
  for (const hidden of ['se­cret', 'se​cret', 'da‍re']) assert.throws(() => screen(`our ${hidden}`), refusedAs('SCREENED'), JSON.stringify(hidden))
})

test('checkTask returns what to store, trimmed, and names every wrong field', () => {
  const good = { category: 'study', title: '  Read ', instructions: ' Chapter 3 ', dueAt: new Date(Date.now() + 86_400_000).toISOString(), points: 20 }
  const stored = checkTask(good)
  assert.deepEqual([stored.title, stored.instructions, stored.category, stored.points], ['Read', 'Chapter 3', 'study', 20])
  assert.ok(stored.dueAt instanceof Date)
  assert.throws(() => checkTask({ category: 5, title: 123, instructions: [], dueAt: 7, points: '20' }), (e) =>
    e.code === 'INVALID' && Object.keys(e.fields).sort().join() === 'category,dueAt,instructions,points,title')
  assert.throws(() => checkTask({ ...good, dueAt: '2020-01-01T10:00:00Z' }), (e) => e.fields.dueAt === 'past') // a new task is due in the future
  checkTask({ ...good, dueAt: '2020-01-01T10:00:00Z' }, new Date('2020-01-01T10:00:30Z')) // an edit that leaves the minute alone may stay in the past
  assert.throws(() => checkTask({ ...good, points: 22 }), (e) => e.fields.points === 'range')
})

// ------------------------------------------------------------------ days follow the zone (rule 25)

test('dayKey and weekKey answer in the zone given, not in the server zone; no zone means the server zone', () => {
  const instant = '2026-11-08T20:00:00Z' // a Sunday evening in London and New York, already Monday in India
  assert.deepEqual(['UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Auckland'].map((zone) => dayKey(instant, zone)), ['2026-11-08', '2026-11-09', '2026-11-08', '2026-11-09'])
  assert.deepEqual(['UTC', 'Asia/Kolkata', 'America/New_York'].map((zone) => weekKey(instant, zone)), ['2026-11-02', '2026-11-09', '2026-11-02'])
  assert.equal(dayKey(instant), dayKey(instant, process.env.TZ)) // TZ=UTC in the env files
  assert.equal(dayKey('2026-03-08T04:59:59Z', 'America/New_York'), '2026-03-07') // the day the clocks go forward: midnight is still 05:00Z
  assert.equal(dayKey('2026-03-08T05:00:00Z', 'America/New_York'), '2026-03-08')
  assert.equal(weekKey('2026-01-01T00:30:00Z', 'UTC'), '2025-12-29') // across a year
})

test('the day marks and week starts are the instants those days begin at in the zone', () => {
  const at = '2026-11-06T20:00:00Z'
  assert.equal(score([], at, [], 'Asia/Kolkata').streak.week.at(-1).day, '2026-11-06T18:30:00.000Z') // it is 01:30 on the 7th there
  assert.equal(score([], at, [], 'America/New_York').streak.week.at(-1).day, '2026-11-06T05:00:00.000Z')
  assert.equal(score([], at, [], 'America/New_York').streak.week.length, 7)
  const weeks = progress([], at, [], 'Asia/Kolkata').weeks
  assert.equal(weeks.at(-1).start, '2026-11-01T18:30:00.000Z') // Monday the 2nd begins at 18:30 on Sunday the 1st
  assert.equal(weeks.length, 6)
})

// ------------------------------------------------------------------ the engagement rules over a snapshot

const ZONE = 'Asia/Kolkata'
const NOW = new Date()
const proof = (id, extra) => ({ id, note: 'A note the child wrote', sentAt: '2026-10-01T10:00:00.000Z', late: false, ...extra })
const task = (id, proofs, extra) => ({
  id, childId: 'c1', childName: 'Aarav', category: 'chores', title: `Task ${id}`, instructions: 'Do it.', dueAt: '2026-10-02T10:00:00.000Z', points: 20,
  status: 'todo', resultSeen: true, pinned: false, createdAt: '2026-10-01T09:00:00.000Z', proofs, ...extra,
})
/** An approved task, its proof sent and approved at `at`. */
const done = (id, points, at, extra) =>
  task(id, [proof(`${id}p`, { sentAt: at, review: { result: 'approved', note: '', by: 'Meera', at } })], { status: 'approved', points, ...extra })
const snapshot = (more) => ({ zone: ZONE, tasks: [], rest: [], quest: null, questAwards: [], awards: {}, requests: [], ...more })

test('itemOf keeps words only: the task as the parent wrote it, the parent\'s notes and how many proofs; no file, child\'s note, name or id', () => {
  const reported = task('t9', [
    proof('f9', { fileType: 'image/png', fileName: 'me.png', review: { result: 'sentBack', note: 'Do it again.', by: 'Meera Joshi', at: '2026-10-01T11:00:00.000Z' } }),
    proof('n9'),
  ], { title: 'Read a chapter' })
  const item = itemOf(reported)
  assert.deepEqual(Object.keys(item).sort(), ['dueAt', 'instructions', 'notes', 'points', 'proofs', 'title'])
  assert.deepEqual([item.notes, item.proofs], [['Do it again.'], 2])
  assert.doesNotMatch(JSON.stringify(item), /me\.png|A note the child wrote|Meera|Aarav|c1|f9|t9/)
})

test('the sealed surprise (rule 19): what a child earned opens as it was, a later change stays sealed, and an approval not yet seen opens nothing', () => {
  const week = weekKey(NOW, ZONE)
  const a1 = done('a1', 100, NOW.toISOString())
  const kept = snapshot({
    tasks: [a1],
    quest: { target: 5, bonus: 20, surprise: 'Next week plan' }, // changed after this week's quest was completed
    questAwards: [{ week, target: 3, bonus: 50, surprise: 'A picnic', earnedAt: NOW.toISOString(), taskId: 'a1', taskTitle: 'Task a1' }],
  })
  const forChild = () => growthForChild(kept, NOW)
  assert.deepEqual([forChild().shown.quest.surprise, forChild().shown.quest.target, forChild().shown.quest.sealed], ['A picnic', 3, false])
  assert.equal(JSON.stringify(forChild()).includes('Next week plan'), false)
  assert.equal(growthOf(kept, NOW).quest.surprise, 'Next week plan') // a parent reads it
  a1.resultSeen = false // not yet seen on Today
  assert.deepEqual([forChild().shown.quest.surprise, forChild().shown.quest.sealed, forChild().quest.surprise], [null, true, null])
  assert.equal(forChild().questAwards[0].seen, false)
  assert.equal(forChild().questAwards[0].surprise, 'A picnic') // the award itself is what Today's reward moment plays
})

test('growthOf: the balance holds a waiting or given request and gives a declined one back; shown counts only what the child has seen', () => {
  const requests = [{ status: 'requested', cost: 50 }, { status: 'declined', cost: 30 }, { status: 'given', cost: 10 }]
  const awards = [{ week: '2026-09-28', target: 3, bonus: 50, surprise: null, earnedAt: '2026-10-01T11:00:00.000Z', taskId: 'a1', taskTitle: 'Task a1' }]
  const seen = snapshot({ tasks: [done('a1', 100, '2026-10-01T11:00:00.000Z')], requests, questAwards: awards })
  const growth = growthOf(seen, NOW)
  assert.deepEqual([growth.points, growth.balance, growth.shown.balance], [100, 90, 90]) // 100 + 50 bonus - 50 - 10
  const unseen = snapshot({ tasks: [done('a1', 100, '2026-10-01T11:00:00.000Z', { resultSeen: false })], requests, questAwards: awards })
  const held = growthOf(unseen, NOW)
  assert.deepEqual([held.balance, held.shown.points, held.shown.balance, held.shown.waitingXp], [90, 0, -60, 0]) // what the child can spend ignores both the points and the bonus until seen
  assert.deepEqual(held.questAwards.map((a) => Object.keys(a).sort().join()), ['bonus,earnedAt,seen,surprise,target,taskId,taskTitle,week'])
})

test('stickerList: an unseen award shows how far along it is, a seen one shows in full', () => {
  const tasks = [done('a1', 20, '2026-10-01T11:00:00.000Z', { resultSeen: false })]
  const awards = { 'first-task': { earnedAt: '2026-10-01T11:00:00.000Z', taskId: 'a1', taskTitle: 'Task a1' } }
  const first = (list) => list.find((s) => s.id === 'first-task')
  const unseen = first(stickerList(snapshot({ tasks, awards }), NOW))
  assert.deepEqual([unseen.seen, unseen.have], [false, 0])
  tasks[0].resultSeen = true
  const shown = first(stickerList(snapshot({ tasks, awards }), NOW))
  assert.deepEqual([shown.seen, 'have' in shown, shown.taskTitle], [true, false, 'Task a1'])
})

test('progressOf: counts and the recorded stickers, in the zone given', () => {
  const tasks = [done('a1', 20, '2026-10-01T11:00:00.000Z'), task('o1', []), task('w1', [proof('w1p')], { status: 'review' }), task('s1', [proof('s1p')], { status: 'sentBack' })]
  const awards = { 'first-task': { earnedAt: '2026-10-01T11:00:00.000Z', taskId: 'a1', taskTitle: 'Task a1' } }
  const out = progressOf(snapshot({ tasks, awards }), { id: 'c1', name: 'Aarav' }, new Date('2026-10-05T10:00:00Z'))
  assert.deepEqual(out.counts, { approved: 1, waiting: 1, open: 2, overdue: 1 }) // o1 was due on the 2nd; the sent-back one is open but not overdue
  assert.deepEqual([out.stickers.find((s) => s.id === 'first-task').taskTitle, out.stickers.find((s) => s.id === 'tasks-10').earnedAt], ['Task a1', undefined])
  assert.equal(out.weeks.length, 6)
})

test('leaderboardOf: shown approvals of the week only, most first then by name, and the week is the family\'s', () => {
  const sent = '2026-11-08T20:00:00.000Z' // Sunday evening in London, already Monday in India
  const monday = new Date('2026-11-09T05:00:00Z')
  const entry = (id, name, tasks, zone) => ({ child: { id, name }, snapshot: snapshot({ zone, tasks }) })
  const board = (zone) => leaderboardOf([entry('a', 'Zed', [done('t1', 20, sent)], zone), entry('b', 'Amy', [done('t2', 20, sent, { resultSeen: false })], zone), entry('c', 'Bo', [], zone)], 'c', monday)
  assert.deepEqual(board(ZONE), [{ name: 'Zed', tasks: 1, you: false }, { name: 'Amy', tasks: 0, you: false }, { name: 'Bo', tasks: 0, you: true }]) // Amy's is not shown yet
  assert.deepEqual(board('UTC').map((e) => e.tasks), [0, 0, 0]) // the same approvals were last week in UTC
})

test('dayKeyIn, isDay and recentRest count calendar days in the zone given', () => {
  const instant = '2026-12-31T20:00:00Z' // already 2027-01-01 01:30 in India
  assert.deepEqual([dayKeyIn(0, instant, ZONE), dayKeyIn(1, instant, ZONE), dayKeyIn(-7, instant, ZONE), dayKeyIn(0, instant, 'UTC')], ['2027-01-01', '2027-01-02', '2026-12-25', '2026-12-31'])
  assert.deepEqual([dayKeyIn(1, '2028-02-28T10:00:00Z', 'UTC'), dayKeyIn(90, '2026-11-06T10:00:00Z', 'UTC')], ['2028-02-29', '2027-02-04'])
  assert.deepEqual(['2026-02-31', '2026-13-01', '2026-2-3', '', '2026-11-06x', '2026-00-10'].map(isDay), [false, false, false, false, false, false])
  assert.deepEqual(['2028-02-29', '2026-11-06', '2026-12-31'].map(isDay), [true, true, true])
  const rest = ['2026-12-20', '2026-12-24', '2026-12-25', '2027-01-03']
  assert.deepEqual(recentRest({ rest, zone: ZONE }, new Date(instant)), ['2026-12-25', '2027-01-03']) // India's today is the 1st of January: 7 back is the 25th
  assert.deepEqual(recentRest({ rest, zone: 'UTC' }, new Date(instant)), ['2026-12-24', '2026-12-25', '2027-01-03']) // in UTC it is still the 31st: 7 back is the 24th
})

test('checkQuest: ranges, a quest already reached this week is "done", and the surprise is trimmed and screened', () => {
  const now = new Date()
  const two = snapshot({ tasks: [done('a', 20, now.toISOString()), done('b', 20, now.toISOString())] })
  assert.throws(() => checkQuest({ target: 2, bonus: 10 }, two, now), (e) => e.code === 'INVALID' && e.fields.target === 'done')
  assert.deepEqual(checkQuest({ target: 3, bonus: 15, surprise: '  Ice cream ' }, two, now), { target: 3, bonus: 15, surprise: 'Ice cream' })
  const paid = snapshot({ ...two, questAwards: [{ week: weekKey(now, ZONE) }] })
  assert.equal(checkQuest({ target: 2, bonus: 10 }, paid, now).target, 2) // this week's is complete, so the change is for next week
  assert.throws(() => checkQuest({ target: 2, bonus: 10, surprise: 'a dare' }, snapshot(), now), (e) => e.code === 'SCREENED')
  assert.throws(() => checkQuest({ target: 1, bonus: 7, surprise: 5 }, snapshot(), now), (e) => Object.keys(e.fields).sort().join() === 'bonus,surprise,target')
})

// ------------------------------------------------------------------ crafted files (final plan Phase 9)

test('MP4: a box that runs past its parent, a size under 8, a 64-bit size past the file or under its own head, and a head cut short are FILE_TYPE', () => {
  const bad = refusedAs('FILE_TYPE')
  const ftyp = box('ftyp', Buffer.from('isom0000isom'))
  /** A box whose size field says `size`, whatever it holds. */
  const sized = (size, type, ...parts) => {
    const made = box(type, ...parts)
    made.writeUInt32BE(size)
    return made
  }
  /** A file whose moov has a 64-bit size field saying `size`. */
  const wide = (size) => {
    const head = Buffer.alloc(16)
    head.writeUInt32BE(1)
    head.write('moov', 4, 'latin1')
    head.writeBigUInt64BE(size, 8)
    return Buffer.concat([ftyp, head, track()])
  }
  const real = 16 + track().length
  strip(wide(BigInt(real)), 'video/mp4') // the control: the true size parses
  assert.throws(() => strip(Buffer.concat([ftyp, box('moov', track(), sized(999, 'udta', Buffer.from(SECRET))), box('mdat')]), 'video/mp4'), bad, 'a udta longer than its moov')
  assert.throws(() => strip(Buffer.concat([ftyp, box('moov', sized(999, 'trak', track().subarray(8)))]), 'video/mp4'), bad, 'a trak longer than its moov')
  for (const size of [2, 4, 7]) assert.throws(() => strip(Buffer.concat([ftyp, box('moov', track(), sized(size, 'udta'))]), 'video/mp4'), bad, `a size of ${size}`)
  for (const size of [BigInt(real + 1), 1n << 40n, 0xffffffffffffffffn, 8n, 0n]) assert.throws(() => strip(wide(size), 'video/mp4'), bad, `a 64-bit size of ${size}`)
  assert.throws(() => strip(Buffer.concat([ftyp, Buffer.from([0, 0, 0, 1]), Buffer.from('moov')]), 'video/mp4'), bad, 'a 64-bit size that is not there')
  assert.throws(() => strip(Buffer.concat([ftyp, box('moov', track()), Buffer.from([0, 0, 0])]), 'video/mp4'), bad, 'three bytes left over')
})

test('MP4: a box of size 0 that is not the last runs to the end, as the format says, so what follows a udta of size 0 is blanked with it', () => {
  const start = [box('ftyp', Buffer.from('isom0000isom')), box('moov', box('mvhd', Buffer.alloc(100)), track())]
  const udta = location()
  udta.writeUInt32BE(0) // size 0: to the end of the file
  const original = Buffer.concat([...start, udta, box('mdat', Buffer.from('frames'))])
  const stored = strip(original, 'video/mp4')
  assert.equal(stored.length, original.length)
  assert.equal(has(stored, SECRET), false)
  assert.equal(has(stored, 'frames'), false) // inside the udta, by the format's own rule
  // Accepted (Phase 9): the other way round, a box of size 0 in front of a udta holds that udta as its contents, so no udta is found
  // and its bytes stay. To a reader that follows the format there is no udta in that file either. Only a file built by hand has
  // this, and what it keeps is the uploader's own.
})

test('lengths that point past the file are FILE_TYPE, never a 500', () => {
  const bad = refusedAs('FILE_TYPE')
  const header = png()
  header.writeUInt32BE(0xffffffff, 8) // the first chunk says it is 4 GB long
  assert.throws(() => strip(header, 'image/png'), bad)
  assert.throws(() => strip(png().subarray(0, 10), 'image/png'), bad) // ends inside a chunk's length
  assert.throws(() => strip(png(chunk('tEXt', Buffer.alloc(5))).subarray(0, 40), 'image/png'), bad) // ends inside a chunk
  for (const [at, size] of [[4, webp().length], [4, 0xffffffff], [4, 3], [16, 0xffffffff], [16, 0xfffffff0]]) {
    const picture = webp()
    picture.writeUInt32LE(size, at) // 4: the RIFF size; 16: the first chunk's size
    assert.throws(() => strip(picture, 'image/webp'), bad, `WebP ${at} ${size}`)
  }
  assert.throws(() => strip(Buffer.from('RIFF\0\0\0\0WEBP'), 'image/webp'), bad) // a RIFF size of nothing
  const start = Buffer.from([0xff, 0xd8])
  for (const length of [0, 1, 0xffff]) assert.throws(() => strip(Buffer.concat([start, Buffer.from([0xff, 0xe1, length >> 8, length & 255]), Buffer.from('Exif\0\0')]), 'image/jpeg'), bad, `JPEG ${length}`)
  assert.throws(() => strip(Buffer.concat([start, segment(0xe0, 'JFIF'), Buffer.from([0xff])]), 'image/jpeg'), bad) // ends inside a marker
  for (const [bytes, type] of [[Buffer.alloc(0), 'image/jpeg'], [Buffer.alloc(0), 'image/png'], [Buffer.alloc(0), 'image/webp'], [Buffer.alloc(0), 'video/mp4'], [Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'], [Buffer.from('89504e47', 'hex'), 'image/png']]) {
    assert.throws(() => strip(bytes, type), bad, `${type} of ${bytes.length} bytes`)
  }
})
