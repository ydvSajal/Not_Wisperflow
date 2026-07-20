// Generates the app + tray icons as PNGs with zero image dependencies.
// Draws a purple rounded square with a white microphone glyph.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // no filter
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const lerp = (a, b, t) => a + (b - a) * t

function drawIcon(size, { background }) {
  const rgba = Buffer.alloc(size * size * 4)
  const s = size / 256 // all coordinates below are in 256-space
  const cx = 128
  const cornerR = 56

  const inRoundedSquare = (x, y) => {
    const dx = Math.max(cornerR - x, x - (256 - cornerR), 0)
    const dy = Math.max(cornerR - y, y - (256 - cornerR), 0)
    return dx * dx + dy * dy <= cornerR * cornerR
  }
  // Mic capsule: rounded rect x 104..152, y 52..140
  const inCapsule = (x, y) => {
    const r = 24
    const px = Math.min(Math.max(x, 104 + r), 152 - r)
    const py = Math.min(Math.max(y, 52 + r), 140 - r)
    return (x - px) ** 2 + (y - py) ** 2 <= r * r || (x >= 104 && x <= 152 && y >= 52 + r && y <= 140 - r)
  }
  // Mic cradle: lower half-ring around (128,124), radius 52, thickness 12
  const inRing = (x, y) => {
    if (y < 124) return false
    const d = Math.hypot(x - cx, y - 124)
    return d >= 46 && d <= 58
  }
  const inStem = (x, y) => x >= 122 && x <= 134 && y >= 176 && y <= 200
  const inBase = (x, y) => x >= 96 && x <= 160 && y >= 198 && y <= 210

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px / s
      const y = py / s
      const i = (py * size + px) * 4
      if (background && !inRoundedSquare(x, y)) continue // transparent
      let r, g, b, a
      if (background) {
        const t = y / 256
        r = Math.round(lerp(0x8b, 0x5b, t))
        g = Math.round(lerp(0x5c, 0x21, t))
        b = Math.round(lerp(0xf6, 0xb6, t))
        a = 255
      } else {
        r = g = b = 0
        a = 0
      }
      if (inCapsule(x, y) || inRing(x, y) || inStem(x, y) || inBase(x, y)) {
        r = g = b = 255
        a = 255
      }
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = a
    }
  }
  return encodePng(rgba, size, size)
}

mkdirSync(join(root, 'build'), { recursive: true })
mkdirSync(join(root, 'resources'), { recursive: true })
writeFileSync(join(root, 'build/icon.png'), drawIcon(256, { background: true }))
writeFileSync(join(root, 'resources/tray.png'), drawIcon(32, { background: true }))
console.log('icons written: build/icon.png (256), resources/tray.png (32)')
