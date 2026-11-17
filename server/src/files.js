import { readFile, readdir, stat, statfs, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from './db.js'
import { ApiError, refuse } from './errors.js'
import { KEEP_PROOF_DAYS } from './rules.js'

/** Proof files (rules 5 and 16, assumptions A5 and A6): what a file is, what it may carry, where it lives and how it is served. */

const bad = () => refuse('FILE_TYPE')
const ascii = (b, at, length) => b.toString('latin1', at, at + length)
const startsWith = (b, bytes) => bytes.every((byte, i) => b[i] === byte)

/** C1: the most parts (segments, chunks, boxes) a file may have; PNG's are smaller, so it gets more. Walking millions would stall the server. */
const MAX_PARTS = 10_000
const MAX_PNG_PARTS = 20_000
/** A counter for one file's walk: each call counts one part, and one past the cap is FILE_TYPE. */
const parts = (cap = MAX_PARTS) => {
  let seen = 0
  return () => ++seen > cap && bad()
}

/** A5, C2: the file's type from its first bytes, never from its name or the browser's claim. One of the six allowed types, or null. */
export function sniff(b) {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp'
  if (ascii(b, 4, 4) === 'ftyp') return ascii(b, 8, 4) === 'qt  ' ? 'video/quicktime' : 'video/mp4'
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm'
  return null
}

/** C3: the name a proof is stored under, from its type: a camera's own name (IMG_20261105_…) carries the date. */
export const NAMES = { 'image/jpeg': 'photo.jpg', 'image/png': 'photo.png', 'image/webp': 'photo.webp', 'video/mp4': 'video.mp4', 'video/quicktime': 'video.mov', 'video/webm': 'video.webm' }

// ------------------------------------------------------------------ A6: no location or camera details are stored

/** The orientation (2 to 8) in a JPEG's EXIF segment, or 1. The EXIF is the camera's own bytes, so any malformed part means 1. */
function orientationOf(segment) {
  try {
    const tiff = segment.subarray(10)
    const little = ascii(tiff, 0, 2) === 'II'
    const u16 = (at) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at))
    const ifd = little ? tiff.readUInt32LE(4) : tiff.readUInt32BE(4)
    for (let i = 0, n = u16(ifd); i < n; i++) {
      const entry = ifd + 2 + i * 12
      if (u16(entry) === 0x0112) {
        const o = u16(entry + 8)
        return o >= 2 && o <= 8 ? o : 1
      }
    }
  } catch {
    // malformed EXIF: no orientation
  }
  return 1
}

/** An APP1 segment holding nothing but this orientation, so a phone photo still shows the right way up. */
const orientationSegment = (o) => Buffer.from(`ffe10022 457869660000 49492a00 08000000 0100 1201 0300 01000000 0${o}000000 00000000`.replaceAll(' ', ''), 'hex')

/** Whether the byte after an FF in coded data starts a marker: not a stuffed 00, not a restart (D0 to D7), not another FF (a fill byte). */
const startsMarker = (m) => m !== undefined && m !== 0x00 && m !== 0xff && !(m >= 0xd0 && m <= 0xd7)

/**
 * Walks every segment of the picture, through its scans to the first EOI, and ends the stored file there: whatever follows (a second
 * picture, a Motion Photo's video) can carry its own EXIF or GPS, so none of it is kept. Drops every APP1 (EXIF and XMP), APP13
 * (IPTC) and COM segment, between the scans too, and keeps the rest, the colour profile included; where the first EXIF was, an
 * orientation of 2 to 8 is put back on its own. A file with no EOI is not a whole picture, so it is refused.
 */
function stripJpeg(b) {
  const out = [b.subarray(0, 2)]
  const count = parts()
  let exifSeen = false
  let scanned = false
  for (let at = 2; ; ) {
    count()
    if (at + 2 > b.length || b[at] !== 0xff) bad()
    const marker = b[at + 1]
    if (marker === 0xd9 && scanned) return Buffer.concat([...out, b.subarray(at, at + 2)]) // the end of the picture
    if (at + 4 > b.length || marker < 0xc0 || marker === 0xff || (marker >= 0xd0 && marker <= 0xd9)) bad()
    const end = at + 2 + b.readUInt16BE(at + 2)
    if (end < at + 4 || end > b.length) bad()
    const segment = b.subarray(at, end)
    if (marker === 0xe1 && !exifSeen && !scanned && ascii(segment, 4, 6) === 'Exif\0\0') {
      exifSeen = true
      const o = orientationOf(segment)
      if (o > 1) out.push(orientationSegment(o))
    } else if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) out.push(segment)
    at = end
    if (marker === 0xda) {
      // the coded data: copied as it is up to the next real marker
      scanned = true
      let next = b.indexOf(0xff, at)
      while (next !== -1 && !startsMarker(b[next + 1])) next = b.indexOf(0xff, next + 1)
      if (next === -1) bad()
      out.push(b.subarray(at, next))
      at = next
    }
  }
}

/** Drops the eXIf and text chunks (they carry camera details and sometimes a GPS position) and tIME (when it was made, C3). Ends at IEND. */
function stripPng(b) {
  if (!b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) bad()
  const out = [b.subarray(0, 8)]
  const count = parts(MAX_PNG_PARTS)
  for (let at = 8; ; ) {
    count()
    const end = at + 12 + b.readUInt32BE(at) // length, type, data, checksum
    if (end > b.length) bad()
    const type = ascii(b, at + 4, 4)
    if (!['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type)) out.push(b.subarray(at, end))
    if (type === 'IEND') return Buffer.concat(out)
    at = end
  }
}

/** Drops the EXIF and XMP chunks, clears their flags in the VP8X header and writes the RIFF size again. */
function stripWebp(b) {
  const end = 8 + b.readUInt32LE(4)
  if (end < 12 || end > b.length) bad()
  const out = [b.subarray(8, 12)]
  const count = parts()
  for (let at = 12; at < end; ) {
    count()
    const size = b.readUInt32LE(at + 4)
    const next = at + 8 + size + (size % 2) // a chunk's data is padded to an even length
    if (next > end) bad()
    const type = ascii(b, at, 4)
    if (type === 'VP8X') {
      if (size < 10) bad()
      const chunk = Buffer.from(b.subarray(at, next))
      chunk[8] &= ~0x0c // the flags byte: 0x08 says there is EXIF, 0x04 XMP
      out.push(chunk)
    } else if (type !== 'EXIF' && type !== 'XMP ') out.push(b.subarray(at, next))
    at = next
  }
  const header = Buffer.alloc(8, 'RIFF')
  header.writeUInt32LE(out.reduce((total, part) => total + part.length, 0), 4) // what follows the size field
  return Buffer.concat([header, ...out])
}

/** The boxes between two offsets as { at, size, head, type }. A box that runs past its parent does not parse. `count` is the file's part counter (C1). */
function boxes(b, from, to, count) {
  const found = []
  for (let at = from; at < to; ) {
    count()
    let size = b.readUInt32BE(at)
    let head = 8
    if (size === 1) {
      size = Number(b.readBigUInt64BE(at + 8)) // a 64-bit size follows the type
      head = 16
    } else if (size === 0) size = to - at // the box runs to the end
    if (size < head || at + size > to) bad()
    found.push({ at, size, head, type: ascii(b, at + 4, 4) })
    at += size
  }
  return found
}

/**
 * T7: the handler kinds of a track that holds no picture or sound, only data recorded beside them: an action camera's GPS route,
 * timed text, and subtitles (sbtl, subt), where drones and dash cameras often write their route.
 */
const DATA_TRACKS = ['meta', 'text', 'gpmd', 'sbtl', 'subt']

/**
 * A5: only a file with a video track is a video. moov/trak/mdia/hdlr names each track's kind: 12 bytes after the `hdlr` tag come the
 * version and flags, pre_defined, then the handler type, which is `vide` for video. M4A audio and AVIF image sequences have none.
 * A6: renames the udta and meta boxes inside moov and inside each trak (C3), and the udta, meta and uuid boxes at the top of the file,
 * to `free` and blanks what they held: same size, and players skip a free box. That is where phones put the place the video was filmed.
 * C3: zeroes the creation and modification times in mvhd, tkhd and mdhd.
 * T7: a data track's samples are blanked where they lie, found through its sample table (stsz the sizes, stsc how many to a chunk,
 * stco or co64 where each chunk starts), and then the track itself becomes a free box. Everything is read from `b` and written to
 * `out`, so blanking never changes what is parsed. A data track whose table is missing or runs past the file, or a fragmented file
 * (moof) with a data track, whose samples the table does not list, is FILE_TYPE: nothing is stored with a route in it. `budget`
 * bounds the work: every byte is blanked at most once in all, however the tables are written.
 */
function stripBoxes(b) {
  const count = parts()
  const inside = (parents) => parents.flatMap((p) => boxes(b, p.at + p.head, p.at + p.size, count)) // each level read once, so counted once
  const named = (list, ...types) => list.filter((box) => types.includes(box.type))
  const within = (list, parent) => list.filter((box) => box.at > parent.at && box.at < parent.at + parent.size)
  const top = boxes(b, 0, b.length, count)
  const moov = named(top, 'moov')
  const inMoov = inside(moov)
  const traks = named(inMoov, 'trak')
  const inTraks = inside(traks)
  const mdias = named(inTraks, 'mdia')
  const inMdias = inside(mdias)
  const handlers = named(inMdias, 'hdlr')
  const kindOf = (box) => (box.size >= box.head + 12 ? ascii(b, box.at + box.head + 8, 4) : '')
  if (moov.length === 0 || !handlers.some((box) => kindOf(box) === 'vide')) bad()
  const out = Buffer.from(b)

  const dataTraks = traks.filter((trak) => within(handlers, trak).some((box) => DATA_TRACKS.includes(kindOf(box))))
  if (dataTraks.length && named(top, 'moof').length) bad()
  const u32 = (at) => b.readUInt32BE(at)
  let budget = b.length
  for (const trak of dataTraks) {
    const tables = inside(named(inside(named(within(inMdias, trak), 'minf')), 'stbl'))
    const [stsz] = named(tables, 'stsz')
    const [stsc] = named(tables, 'stsc')
    const [stco] = named(tables, 'stco', 'co64')
    if (!stsz || !stsc || !stco) bad()
    const z = stsz.at + stsz.head // version and flags, one size for all (or 0), the count, then a size each
    const c = stsc.at + stsc.head // version and flags, the count, then (first chunk, samples per chunk, description) each
    const o = stco.at + stco.head // version and flags, the count, then an offset each
    const wide = stco.type === 'co64'
    if (stsz.size < stsz.head + 12 || stsc.size < stsc.head + 8 || stco.size < stco.head + 8) bad()
    const [fixed, samples, runs, chunks] = [u32(z + 4), u32(z + 8), u32(c + 4), u32(o + 4)]
    if ((fixed === 0 && stsz.size < stsz.head + 12 + samples * 4) || stsc.size < stsc.head + 8 + runs * 12 || stco.size < stco.head + 8 + chunks * (wide ? 8 : 4)) bad()
    let sample = 0
    let run = 0
    for (let chunk = 0; chunk < chunks; chunk++) {
      while (run + 1 < runs && u32(c + 8 + (run + 1) * 12) <= chunk + 1) run++ // the last run that starts at or before this chunk
      const perChunk = runs ? u32(c + 8 + run * 12 + 4) : 0
      let length = 0
      // stops once the chunk is longer than the file, so a table that claims billions of samples of one size cannot stall the server
      for (let i = 0; i < perChunk && sample < samples && length <= b.length; i++, sample++) length += fixed || u32(z + 12 + sample * 4)
      const from = wide ? Number(b.readBigUInt64BE(o + 8 + chunk * 8)) : u32(o + 8 + chunk * 4)
      if (from + length > b.length || (budget -= length) < 0) bad()
      out.fill(0, from, from + length)
    }
  }

  for (const box of [...named(top, 'udta', 'meta', 'uuid'), ...named(inMoov, 'udta', 'meta'), ...named(inTraks, 'udta', 'meta'), ...dataTraks]) {
    out.write('free', box.at + 4, 'latin1')
    out.fill(0, box.at + box.head, box.at + box.size) // the rename alone would leave the place name readable inside the file
  }
  // after the version byte and three flag bytes: two 32-bit times in version 0, two 64-bit ones in version 1
  for (const box of [...named(inMoov, 'mvhd'), ...named(inTraks, 'tkhd'), ...named(inMdias, 'mdhd')]) {
    const at = box.at + box.head
    const length = b[at] === 1 ? 16 : 8
    if (box.size < box.head + 4 + length) bad()
    out.fill(0, at + 4, at + 4 + length)
  }
  return out
}

const STRIP = { 'image/jpeg': stripJpeg, 'image/png': stripPng, 'image/webp': stripWebp, 'video/mp4': stripBoxes, 'video/quicktime': stripBoxes }

/**
 * A6: the bytes to store. Photos and videos lose their location and camera details, by editing bytes only (no re-encoding). WebM
 * files are stored as sent. A file whose structure does not parse is FILE_TYPE, so nothing is stored with its details.
 * ponytail: phone cameras do not write location into a WebM; strip it too if that changes.
 */
export function strip(buffer, type) {
  try {
    return STRIP[type]?.(buffer) ?? buffer
  } catch (error) {
    if (error instanceof RangeError) bad() // a length that runs past the end of the buffer
    throw error
  }
}

// ------------------------------------------------------------------ storing and serving

const stored = (id) => path.join(process.env.UPLOAD_DIR, id)

/** A proof's id, which is its file's name: randomUUID's form. */
const PROOF_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** C5: a file this new may still be on its way to its row (this server, or a second copy of it starting up), so it is never swept. */
const SETTLED_MS = 60 * 60_000
/** C5: more orphans than this at once is not what a crash leaves (at most 4 uploads run at a time): it is the wrong database. */
const MOST_ORPHANS = 10

/**
 * C5, at start-up, before the server listens: removes the files in `dir` that no proof with a file names. They are left when the
 * server stopped between writing a file and its row, or a delete could not unlink one. Only names shaped like a proof id are ever
 * touched, so a mistyped UPLOAD_DIR cannot lose anyone's own files, and only files over an hour old. When more than MOST_ORPHANS
 * would go, nothing goes: DATABASE_URL naming another database would otherwise delete every proof for good. Returns how many went.
 */
export async function sweepOrphans(dir = process.env.UPLOAD_DIR) {
  const entries = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && PROOF_ID.test(entry.name))
  const settled = []
  for (const { name } of entries) if ((await stat(path.join(dir, name))).mtimeMs < Date.now() - SETTLED_MS) settled.push(name)
  const kept = new Set((await db.proof.findMany({ where: { id: { in: settled }, fileType: { not: null } }, select: { id: true } })).map((proof) => proof.id))
  const orphans = settled.filter((name) => !kept.has(name))
  if (orphans.length > MOST_ORPHANS) {
    console.error(`GrowKid left ${orphans.length} proof files that no proof names: that many suggests DATABASE_URL names the wrong database. Check it.`)
    return 0
  }
  await Promise.all(orphans.map((name) => unlink(path.join(dir, name))))
  return orphans.length
}

/** L9: whether the drive that holds `dir` still has `floor` bytes free once `bytes` more are written. */
export async function hasRoom(dir, bytes, floor) {
  const { bavail, bsize } = await statfs(dir)
  return bavail * bsize - bytes >= floor
}

/** Writes a proof's file under its id, with no extension. `wx` refuses to overwrite: an id is never reused. */
export const saveFile = (id, bytes) => writeFile(stored(id), bytes, { flag: 'wx', mode: 0o600 })

/** Rule 16: unlinks the stored files of these proofs after their rows are gone. A failure is logged by proof id only. */
export async function removeFiles(proofIds) {
  const done = await Promise.allSettled(proofIds.map((id) => unlink(stored(id))))
  done.forEach((result, i) => {
    if (result.status === 'rejected' && result.reason?.code !== 'ENOENT') console.error('could not remove the file of proof', proofIds[i])
  })
}

/** T4: at most this many files go per setting in one run; the next run, a day later or at the next start, takes the rest. */
const MOST_REMOVED = 1000

/**
 * T4: deletes the file of every proof whose task was approved longer ago than its family keeps proof files, and marks the proof
 * removed; the row, the note and the review stay. The file goes first and the mark second, so a run that stops between them is put
 * right by the next: the proof is still unmarked, its file is already gone, and it is marked then. A file that will not unlink stays
 * unmarked and is tried again. `time` is the real time, never the development clock: a clock moved a year ahead would delete every
 * family's files for good. Returns how many were removed.
 * ponytail: 1,000 per setting per run; raise it or loop if a server ever holds more old files than that.
 */
export async function removeOldProofFiles(time) {
  let removed = 0
  for (const days of KEEP_PROOF_DAYS) {
    const before = new Date(+time - days * 86_400_000)
    const old = await db.proof.findMany({
      where: { fileType: { not: null }, removedAt: null, task: { status: 'approved', child: { parent: { keepProofDays: days } }, proofs: { some: { result: 'approved', reviewedAt: { lt: before } } } } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: MOST_REMOVED,
    })
    const gone = []
    for (const { id } of old) {
      try {
        await unlink(stored(id))
        gone.push(id)
      } catch (error) {
        if (error.code === 'ENOENT') gone.push(id)
      }
    }
    removed += (await db.proof.updateMany({ where: { id: { in: gone }, removedAt: null }, data: { removedAt: time } })).count
  }
  return removed
}

/** T6: a kept proof's bytes, for the family's export. */
export const readProofFile = (id) => readFile(stored(id))

/**
 * Serves a proof's file. res.sendFile answers Range requests, which video needs. `root` keeps send's dotfile rule from
 * looking at the folder's own path. Resolves once the response is sent; a file that is gone is NOT_FOUND.
 * C4: the file's own headers, stated here rather than left to Helmet's defaults, because a file can open as its own page: it may run
 * nothing and no other site may embed it. C2: a PDF stored before PDFs were dropped downloads instead of opening.
 */
export const sendProofFile = (res, proof) =>
  new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': proof.fileType,
      'Content-Disposition': proof.fileType === 'application/pdf' ? 'attachment; filename="proof.pdf"' : 'inline',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'private, no-store',
    }
    res.sendFile(proof.id, { root: process.env.UPLOAD_DIR, headers }, (err) => {
      if (!err || err.code === 'ECONNABORTED' || res.headersSent) return resolve() // sent, or the browser went away
      if (err.status === 416) {
        res.status(416).set(err.headers).end() // a range past the end of the file
        return resolve()
      }
      reject(err.code === 'ENOENT' ? new ApiError('NOT_FOUND') : err)
    })
  })
