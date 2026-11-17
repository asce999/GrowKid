import { crc32 } from 'node:zlib'

/**
 * T6: a .zip written by hand, a part at a time, with no dependency: every entry is stored (not compressed), so its checksum and
 * size are known before its header is written. `write` takes a Buffer and resolves once it has gone. Names are UTF-8.
 * ponytail: no zip64, so under 4 GiB in all (a family's 2 GiB quota keeps it there) and under 65,536 entries (the caller caps them).
 */
export function zipWriter(write, at = new Date()) {
  const time = (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (at.getUTCSeconds() >> 1)
  const date = ((at.getUTCFullYear() - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate()
  const central = []
  let offset = 0
  return {
    /** One entry: its local header, its name, its bytes. */
    async add(name, bytes) {
      const file = Buffer.from(name)
      const local = Buffer.alloc(30)
      local.writeUInt32LE(0x04034b50, 0)
      local.writeUInt16LE(20, 4) // the version needed to read it
      local.writeUInt16LE(0x0800, 6) // the name is UTF-8
      local.writeUInt16LE(time, 10)
      local.writeUInt16LE(date, 12)
      local.writeUInt32LE(crc32(bytes), 14)
      local.writeUInt32LE(bytes.length, 18)
      local.writeUInt32LE(bytes.length, 22)
      local.writeUInt16LE(file.length, 26)
      const entry = Buffer.alloc(46)
      entry.writeUInt32LE(0x02014b50, 0)
      entry.writeUInt16LE(20, 4)
      entry.writeUInt16LE(20, 6)
      local.copy(entry, 8, 6, 30) // flags to name length: the same 24 bytes in both headers
      entry.writeUInt32LE(offset, 42)
      central.push(entry, file)
      offset += 30 + file.length + bytes.length
      await write(local)
      await write(file)
      await write(bytes)
    },
    /** The list of entries and the end record. Without them the file does not open, which is right for an export cut short. */
    async end() {
      const tail = Buffer.alloc(22)
      tail.writeUInt32LE(0x06054b50, 0)
      tail.writeUInt16LE(central.length / 2, 8)
      tail.writeUInt16LE(central.length / 2, 10)
      tail.writeUInt32LE(central.reduce((total, part) => total + part.length, 0), 12)
      tail.writeUInt32LE(offset, 16)
      for (const part of central) await write(part)
      await write(tail)
    },
  }
}
