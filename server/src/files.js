import { unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ApiError, refuse } from './errors.js'

/** Proof files (rules 5 and 16, assumptions A5 and A6): what a file is, what it may carry, where it lives and how it is served. */

const bad = () => refuse('FILE_TYPE')
const ascii = (b, at, length) => b.toString('latin1', at, at + length)
const startsWith = (b, bytes) => bytes.every((byte, i) => b[i] === byte)

/** A5: the file's type from its first bytes, never from its name or the browser's claim. One of the seven allowed types, or null. */
export function sniff(b) {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp'
  if (ascii(b, 0, 5) === '%PDF-') return 'application/pdf'
  if (ascii(b, 4, 4) === 'ftyp') return ascii(b, 8, 4) === 'qt  ' ? 'video/quicktime' : 'video/mp4'
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm'
  return null
}

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
  let exifSeen = false
  let scanned = false
  for (let at = 2; ; ) {
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

/** Drops the eXIf and text chunks (they carry camera details and sometimes a GPS position). Ends at IEND. */
function stripPng(b) {
  if (!b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) bad()
  const out = [b.subarray(0, 8)]
  for (let at = 8; ; ) {
    const end = at + 12 + b.readUInt32BE(at) // length, type, data, checksum
    if (end > b.length) bad()
    const type = ascii(b, at + 4, 4)
    if (!['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(type)) out.push(b.subarray(at, end))
    if (type === 'IEND') return Buffer.concat(out)
    at = end
  }
}

/** Drops the EXIF and XMP chunks, clears their flags in the VP8X header and writes the RIFF size again. */
function stripWebp(b) {
  const end = 8 + b.readUInt32LE(4)
  if (end < 12 || end > b.length) bad()
  const out = [b.subarray(8, 12)]
  for (let at = 12; at < end; ) {
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

/** The boxes between two offsets as { at, size, head, type }. A box that runs past its parent does not parse. */
function boxes(b, from, to) {
  const found = []
  for (let at = from; at < to; ) {
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

/** The boxes of this type directly inside each of the parent boxes. */
const within = (b, parents, type) => parents.flatMap((p) => boxes(b, p.at + p.head, p.at + p.size)).filter((box) => box.type === type)

/**
 * A5: only a file with a video track is a video. moov/trak/mdia/hdlr names each track's kind: 12 bytes after the `hdlr` tag come the
 * version and flags, pre_defined, then the handler type, which is `vide` for video. M4A audio and AVIF image sequences have none.
 * A6: renames the udta and meta boxes inside moov, and the udta, meta and uuid boxes at the top of the file, to `free` and blanks what
 * they held: same size, and players skip a free box. That is where phones put the place the video was filmed.
 * ponytail: per-track timed GPS (the metadata tracks of action cameras) is not stripped.
 */
function stripBoxes(b) {
  const top = boxes(b, 0, b.length)
  const moov = top.filter((box) => box.type === 'moov')
  const handlers = within(b, within(b, within(b, moov, 'trak'), 'mdia'), 'hdlr')
  if (moov.length === 0 || !handlers.some((box) => box.size >= box.head + 12 && ascii(b, box.at + box.head + 8, 4) === 'vide')) bad()
  const out = Buffer.from(b)
  const holds = [...top.filter((box) => ['udta', 'meta', 'uuid'].includes(box.type)), ...within(b, moov, 'udta'), ...within(b, moov, 'meta')]
  for (const box of holds) {
    out.write('free', box.at + 4, 'latin1')
    out.fill(0, box.at + box.head, box.at + box.size) // the rename alone would leave the place name readable inside the file
  }
  return out
}

const STRIP = { 'image/jpeg': stripJpeg, 'image/png': stripPng, 'image/webp': stripWebp, 'video/mp4': stripBoxes, 'video/quicktime': stripBoxes }

/**
 * A6: the bytes to store. Photos and videos lose their location and camera details, by editing bytes only (no re-encoding). PDFs and
 * WebM files are stored as sent. A file whose structure does not parse is FILE_TYPE, so nothing is stored with its details.
 * ponytail: phone cameras do not write location into a PDF or a WebM; strip them too if that changes.
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

/** A display name for a file: at most 100 characters of letters, digits, dot, dash, underscore and space. Never used as a path. */
export const safeName = (name) => path.posix.basename(String(name ?? '')).replace(/[^\w.\- ]/g, '_').slice(0, 100).trim() || 'file'

/** Writes a proof's file under its id, with no extension. `wx` refuses to overwrite: an id is never reused. */
export const saveFile = (id, bytes) => writeFile(stored(id), bytes, { flag: 'wx', mode: 0o600 })

/** Rule 16: unlinks the stored files of these proofs after their rows are gone. A failure is logged by proof id only. */
export async function removeFiles(proofIds) {
  const done = await Promise.allSettled(proofIds.map((id) => unlink(stored(id))))
  done.forEach((result, i) => {
    if (result.status === 'rejected' && result.reason?.code !== 'ENOENT') console.error('could not remove the file of proof', proofIds[i])
  })
}

/**
 * Serves a proof's file. res.sendFile answers Range requests, which video needs. `root` keeps send's dotfile rule from
 * looking at the folder's own path. Resolves once the response is sent; a file that is gone is NOT_FOUND.
 */
export const sendProofFile = (res, proof) =>
  new Promise((resolve, reject) => {
    const headers = { 'Content-Type': proof.fileType, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store' }
    res.sendFile(proof.id, { root: process.env.UPLOAD_DIR, headers }, (err) => {
      if (!err || err.code === 'ECONNABORTED' || res.headersSent) return resolve() // sent, or the browser went away
      if (err.status === 416) {
        res.status(416).set(err.headers).end() // a range past the end of the file
        return resolve()
      }
      reject(err.code === 'ENOENT' ? new ApiError('NOT_FOUND') : err)
    })
  })
