// Dependency-free PWA icon generator.
// Renders the Kira "K" ledger mark to PNG (192/512/apple-touch) + SVG,
// with 4x supersampled antialiasing. No native libs — just zlib + fs.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(OUT, { recursive: true })

// --- Brand palette ---------------------------------------------------------
const BG_TOP = [79, 70, 229] // #4f46e5 indigo
const BG_BOT = [124, 58, 237] // #7c3aed violet
const INK = [255, 255, 255]

// --- CRC32 + PNG chunk writer ---------------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  // rows with filter byte 0
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- geometry helpers ------------------------------------------------------
// K glyph defined on a 0..1 unit square, as a union of convex polygons.
const STROKE = 0.135
const stemL = 0.30
const K = [
  // vertical stem
  [
    [stemL, 0.24],
    [stemL + STROKE, 0.24],
    [stemL + STROKE, 0.76],
    [stemL, 0.76],
  ],
  // upper arm (stem middle -> top right)
  [
    [stemL + STROKE - 0.01, 0.5],
    [0.60, 0.24],
    [0.72, 0.24],
    [stemL + STROKE - 0.01, 0.52],
  ],
  // lower arm (stem middle -> bottom right)
  [
    [stemL + STROKE - 0.01, 0.48],
    [0.60, 0.76],
    [0.72, 0.76],
    [stemL + STROKE - 0.01, 0.50],
  ],
]
function inPoly(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}
function inK(x, y) {
  for (const poly of K) if (inPoly(x, y, poly)) return true
  return false
}
// rounded-square coverage (unit space), radius r
function inRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r)
  const cy = Math.min(Math.max(y, r), 1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function render(size, { rounded = true } = {}) {
  const SS = 4 // supersample factor
  const S = size * SS
  const rgba = Buffer.alloc(size * size * 4)
  const r = 0.22 // corner radius (unit)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCov = 0
      let inkCov = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = (x + (sx + 0.5) / SS) / size
          const uy = (y + (sy + 0.5) / SS) / size
          const bgHit = rounded ? inRoundedRect(ux, uy, r) : true
          if (bgHit) bgCov++
          if (bgHit && inK(ux, uy)) inkCov++
        }
      }
      const total = SS * SS
      bgCov /= total
      inkCov /= total
      const uy = (y + 0.5) / size
      const bg = [
        Math.round(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * uy),
        Math.round(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * uy),
        Math.round(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * uy),
      ]
      // composite ink over bg by ink coverage
      const rr = Math.round(bg[0] * (1 - inkCov) + INK[0] * inkCov)
      const gg = Math.round(bg[1] * (1 - inkCov) + INK[1] * inkCov)
      const bb = Math.round(bg[2] * (1 - inkCov) + INK[2] * inkCov)
      const a = Math.round(255 * bgCov)
      const o = (y * size + x) * 4
      rgba[o] = rr
      rgba[o + 1] = gg
      rgba[o + 2] = bb
      rgba[o + 3] = a
    }
  }
  return encodePNG(size, size, rgba)
}

// --- write PNGs ------------------------------------------------------------
writeFileSync(join(OUT, 'pwa-192x192.png'), render(192))
writeFileSync(join(OUT, 'pwa-512x512.png'), render(512))
writeFileSync(join(OUT, 'apple-touch-icon.png'), render(180, { rounded: false }))

// --- SVG (crisp at any size) ----------------------------------------------
const kPath = K.map(
  (poly) =>
    'M' +
    poly.map(([x, y]) => `${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`).join(' L') +
    'Z',
).join(' ')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="Kira">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#g)"/>
  <path d="${kPath}" fill="#ffffff"/>
</svg>
`
writeFileSync(join(OUT, 'icon.svg'), svg)
writeFileSync(join(OUT, 'favicon.svg'), svg)

console.log('icons written to public/:', [
  'pwa-192x192.png',
  'pwa-512x512.png',
  'apple-touch-icon.png',
  'icon.svg',
  'favicon.svg',
])
