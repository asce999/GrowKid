import { crc32, deflateSync } from 'node:zlib'

/** Proof files built inline from a few bytes (plan section 8): no binary files in the repo. SECRET stands for a place name in a file's details. */
export const SECRET = 'SECRETPLACE'

const u16 = (n) => Buffer.from([n >> 8, n & 255])

// ------------------------------------------------------------------ JPEG

/** An EXIF block (little-endian TIFF) holding an orientation and a GPS block with a place name after it. */
const exif = (orientation) => {
  const t = Buffer.alloc(56)
  t.write('II', 0)
  t.writeUInt16LE(42, 2)
  t.writeUInt32LE(8, 4) // IFD0 starts here
  t.writeUInt16LE(2, 8) // two entries: orientation, then the pointer to the GPS block
  t.writeUInt16LE(0x0112, 10)
  t.writeUInt16LE(3, 12)
  t.writeUInt32LE(1, 14)
  t.writeUInt16LE(orientation, 18)
  t.writeUInt16LE(0x8825, 22)
  t.writeUInt16LE(4, 24)
  t.writeUInt32LE(1, 26)
  t.writeUInt32LE(38, 30)
  t.writeUInt32LE(0, 34) // no next IFD
  t.writeUInt16LE(1, 38) // the GPS block: one entry, the latitude reference
  t.writeUInt16LE(1, 40)
  t.writeUInt16LE(2, 42)
  t.writeUInt32LE(2, 44)
  t.write('N\0', 48, 'latin1')
  return Buffer.concat([Buffer.from('Exif\0\0'), t, Buffer.from(SECRET)])
}

export const segment = (marker, data) => Buffer.concat([Buffer.from([0xff, marker]), u16(data.length + 2), Buffer.from(data)])

/** A JPEG with every kind of segment a phone writes: JFIF, EXIF with GPS, XMP, IPTC, a comment and a colour profile, then a tiny scan. */
export const jpeg = (orientation = 6) =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    segment(0xe1, exif(orientation)),
    segment(0xe1, `http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>${SECRET}</x:xmpmeta>`),
    segment(0xed, `Photoshop 3.0\0${SECRET}`),
    segment(0xfe, `${SECRET} comment`),
    segment(0xe2, 'ICC_PROFILE\0\x01\x01profile'),
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
    Buffer.from('SCANDATA'),
    Buffer.from([0xff, 0xd9]),
  ])

/** A JPEG whose EXIF segment says it is 5,000 bytes long and then ends. */
export const brokenJpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x13, 0x88]), Buffer.from('Exif\0\0short')])

// ------------------------------------------------------------------ PNG

export const chunk = (type, data = Buffer.alloc(0)) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const size = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc32(body))
  return Buffer.concat([size, body, sum])
}

/** A real 1x1 PNG. `extra` chunks go in after the header. */
export const png = (...extra) =>
  Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', Buffer.from('00000001000000010802000000', 'hex')),
    ...extra,
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0]))),
    chunk('IEND'),
  ])

// ------------------------------------------------------------------ WebP

const le32 = (n) => {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n)
  return b
}
const riffChunk = (type, data) => Buffer.concat([Buffer.from(type), le32(data.length), data, Buffer.alloc(data.length % 2)])

/** A WebP whose VP8X header says there is EXIF and XMP, followed by both. */
export const webp = () => {
  const header = Buffer.alloc(10)
  header[0] = 0x2c // ICC (kept), EXIF and XMP
  const body = Buffer.concat([
    Buffer.from('WEBP'),
    riffChunk('VP8X', header),
    riffChunk('VP8L', Buffer.from([0x2f, 0, 0, 0, 0])),
    riffChunk('EXIF', Buffer.from(SECRET)),
    riffChunk('XMP ', Buffer.from(SECRET)),
  ])
  return Buffer.concat([Buffer.from('RIFF'), le32(body.length), body])
}

// ------------------------------------------------------------------ MP4, QuickTime, PDF, WebM

export const box = (type, ...parts) => {
  const body = Buffer.concat(parts)
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + body.length)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, body])
}

/** The box that holds the place a phone filmed in: moov/udta/©xyz. */
export const location = () => box('udta', box('©xyz', Buffer.from(SECRET)))

/** moov/trak/mdia/hdlr: a track and its kind, `vide` for video, `soun` for sound, `pict` for the pictures of an AVIF sequence. */
export const track = (handler = 'vide') => box('trak', box('mdia', box('hdlr', Buffer.alloc(8), Buffer.from(handler), Buffer.alloc(12))))

/** An MP4 (or a QuickTime movie, with brand 'qt  ') with one track of this kind, and `inMoov` boxes after it. */
export const mp4 = (inMoov = [location()], brand = 'isom', handler = 'vide') =>
  Buffer.concat([box('ftyp', Buffer.from(brand.padEnd(4)), Buffer.alloc(4), Buffer.from('isom')), box('moov', box('mvhd', Buffer.alloc(100)), track(handler), ...inMoov), box('mdat', Buffer.from('frames'))])

export const pdf = () => Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< >>\n%%EOF\n')
export const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(40, 1)])
export const text = () => Buffer.from('This is only text, whatever it is called.')
