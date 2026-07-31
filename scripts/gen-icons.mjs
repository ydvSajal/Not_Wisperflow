// Generates the app + tray icons as PNGs with zero image dependencies.
// Draws a purple rounded square with an off-white "S" glyph.
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

/*
 * The "S" is two tangent circular arcs. Both lobes share a radius and sit one
 * radius above and below the centre, so they meet exactly at (128,128) with a
 * common horizontal tangent, which is what makes the join look continuous.
 * Cutting the right/lower-right out of the upper lobe is what turns it from an
 * O into an S; the lower lobe is that same arc rotated 180 degrees.
 */
const S_R = 33 // lobe centre-line radius
const S_HALF = 14 // half the stroke thickness
const S_TERMINAL = (-25 * Math.PI) / 180 // angle the upper-right terminal is cut at
const INK = [0xf4, 0xf1, 0xed] // off-white, matches --c-canvas

function onUpperArc(x, y) {
  const dx = x - 128
  const dy = y - (128 - S_R)
  if (Math.abs(Math.hypot(dx, dy) - S_R) > S_HALF) return false
  const ang = Math.atan2(dy, dx) // y grows downward: -PI/2 is up, +PI/2 is down
  return !(ang > S_TERMINAL && ang < Math.PI / 2)
}
const inGlyph = (x, y) => onUpperArc(x, y) || onUpperArc(256 - x, 256 - y)

const SS = 4 // supersampling grid; curves alias badly at 32px without it

function drawIcon(size, { background }) {
  const rgba = Buffer.alloc(size * size * 4)
  const s = size / 256 // all coordinates below are in 256-space
  const cornerR = 56

  const inRoundedSquare = (x, y) => {
    const dx = Math.max(cornerR - x, x - (256 - cornerR), 0)
    const dy = Math.max(cornerR - y, y - (256 - cornerR), 0)
    return dx * dx + dy * dy <= cornerR * cornerR
  }

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sr = 0
      let sg = 0
      let sb = 0
      let hits = 0
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const x = (px + (i + 0.5) / SS) / s
          const y = (py + (j + 0.5) / SS) / s
          let c
          if (inGlyph(x, y)) {
            c = INK
          } else if (background && inRoundedSquare(x, y)) {
            // Matches --c-accent (#6d4aff) shading to a deeper violet.
            const t = y / 256
            c = [lerp(0x6d, 0x45, t), lerp(0x4a, 0x27, t), lerp(0xff, 0xc4, t)]
          } else {
            continue // transparent sample
          }
          sr += c[0]
          sg += c[1]
          sb += c[2]
          hits++
        }
      }
      const i = (py * size + px) * 4
      if (!hits) continue // fully transparent pixel
      // Un-premultiply: colour is the average of covering samples, alpha is
      // the coverage fraction. Keeps edges clean over any backdrop.
      rgba[i] = Math.round(sr / hits)
      rgba[i + 1] = Math.round(sg / hits)
      rgba[i + 2] = Math.round(sb / hits)
      rgba[i + 3] = Math.round((hits / (SS * SS)) * 255)
    }
  }
  return encodePng(rgba, size, size)
}

mkdirSync(join(root, 'build'), { recursive: true })
mkdirSync(join(root, 'resources'), { recursive: true })
writeFileSync(join(root, 'build/icon.png'), drawIcon(256, { background: true }))
writeFileSync(join(root, 'resources/tray.png'), drawIcon(32, { background: true }))
console.log('icons written: build/icon.png (256), resources/tray.png (32)')
