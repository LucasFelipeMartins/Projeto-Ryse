/**
 * Gera os ícones PNG do Ryse sem nenhuma dependência externa.
 *
 * Desenha a mesma marca do <RyseMark />: quadrado laranja com três barras
 * ascendentes. A rasterização usa supersampling 4×4 para as bordas ficarem
 * suaves em qualquer tamanho.
 *
 *   npm run icons
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------- PNG ENCODER */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** `rgba` = Uint8Array de size*size*4. */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 10..12 = compression / filter / interlace, todos 0

  // Cada scanline recebe o byte de filtro 0 (None) na frente.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const at = y * (size * 4 + 1);
    raw[at] = 0;
    rgba.copy
      ? rgba.copy(raw, at + 1, y * size * 4, (y + 1) * size * 4)
      : Buffer.from(rgba.subarray(y * size * 4, (y + 1) * size * 4)).copy(raw, at + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------- RASTERIZER */

/** Distância assinada até um retângulo de cantos arredondados. */
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

const BRAND = [255, 106, 0]; // #FF6A00
const INK = [15, 15, 15]; // quase preto — 6.9:1 sobre o laranja

/**
 * @param {number} size    lado do PNG em px
 * @param {object} opts
 * @param {boolean} opts.rounded  arredonda o fundo (false para maskable/iOS)
 * @param {number}  opts.inset    fração do lado reservada como margem da marca
 */
function drawIcon(size, { rounded = true, inset = 0 } = {}) {
  const out = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling por eixo
  const unit = size / 32; // a marca é desenhada num grid de 32×32

  // Área útil da marca depois da margem (usada nos ícones maskable).
  const pad = size * inset;
  const inner = size - pad * 2;
  const u = inner / 32;

  const bars = [
    { x: 8, y: 19, w: 3.6, h: 5.6, r: 1.8, a: 0.55 },
    { x: 14.2, y: 14.6, w: 3.6, h: 10, r: 1.8, a: 0.8 },
    { x: 20.4, y: 9.4, w: 3.6, h: 15.2, r: 1.8, a: 1 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;

          // 1. fundo laranja
          const bgD = rounded
            ? sdRoundRect(px, py, 0, 0, size, size, unit * 8.5)
            : -1;
          let sr = 0;
          let sg = 0;
          let sb = 0;
          let sa = 0;
          if (bgD <= 0) {
            [sr, sg, sb] = BRAND;
            sa = 1;
          }

          // 2. barras compostas por cima
          if (sa > 0) {
            for (const bar of bars) {
              const d = sdRoundRect(
                px,
                py,
                pad + bar.x * u,
                pad + bar.y * u,
                bar.w * u,
                bar.h * u,
                bar.r * u,
              );
              if (d <= 0) {
                sr = sr * (1 - bar.a) + INK[0] * bar.a;
                sg = sg * (1 - bar.a) + INK[1] * bar.a;
                sb = sb * (1 - bar.a) + INK[2] * bar.a;
              }
            }
          }

          r += sr;
          g += sg;
          b += sb;
          a += sa;
        }
      }

      const n = SS * SS;
      const i = (y * size + x) * 4;
      const alpha = a / n;
      // Cor já vem pré-multiplicada pela cobertura; divide para desfazer.
      out[i] = alpha > 0 ? Math.round(r / a) : 0;
      out[i + 1] = alpha > 0 ? Math.round(g / a) : 0;
      out[i + 2] = alpha > 0 ? Math.round(b / a) : 0;
      out[i + 3] = Math.round(alpha * 255);
    }
  }

  return out;
}

/* -------------------------------------------------------------------- MAIN */

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, opts: { rounded: true } },
  { file: 'public/icons/icon-512.png', size: 512, opts: { rounded: true } },
  // Maskable: fundo sangrado + marca dentro da zona segura de 80%.
  { file: 'public/icons/maskable-512.png', size: 512, opts: { rounded: false, inset: 0.14 } },
  // iOS aplica a própria máscara: enviamos o quadrado cheio.
  { file: 'public/icons/apple-touch-icon.png', size: 180, opts: { rounded: false } },
  { file: 'app/icon.png', size: 64, opts: { rounded: true } },
  { file: 'app/apple-icon.png', size: 180, opts: { rounded: false } },
];

for (const t of targets) {
  const path = resolve(ROOT, t.file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(t.size, drawIcon(t.size, t.opts)));
  console.log(`✓ ${t.file} (${t.size}×${t.size})`);
}

console.log('\nÍcones gerados.');
