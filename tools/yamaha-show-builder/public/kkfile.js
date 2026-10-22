// .kk show files.
//
//   0  "KKSB"            magic
//   4  u8   format       1
//   5  u8   flags        bit 0: body is gzip
//   6  u16  header len   big-endian
//   8  header            UTF-8 JSON: { app, version, saved, name, desk }, readable without unpacking
//   .. body              gzip of the show as UTF-8 JSON
//   -4 u32  CRC-32       of everything before it
//
// Old .json / .show.json files still open (readShowFile sniffs the magic).
const MAGIC = [0x4b, 0x4b, 0x53, 0x42]; // KKSB
const FORMAT = 1;
const GZIP = 1;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
const gzip = (bytes) => pipe(bytes, new CompressionStream('gzip'));
const gunzip = (bytes) => pipe(bytes, new DecompressionStream('gzip'));

export const isKk = (bytes) => bytes.length >= 12 && MAGIC.every((b, i) => bytes[i] === b);

export async function writeKk(show, { version = '', desk = '' } = {}) {
  const enc = new TextEncoder();
  const header = enc.encode(
    JSON.stringify({
      app: 'KobiKraken Show Builder',
      version,
      saved: new Date().toISOString(),
      name: show.name,
      desk,
    }),
  );
  const body = await gzip(enc.encode(JSON.stringify(show)));
  const out = new Uint8Array(8 + header.length + body.length + 4);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  view.setUint8(4, FORMAT);
  view.setUint8(5, GZIP);
  view.setUint16(6, header.length);
  out.set(header, 8);
  out.set(body, 8 + header.length);
  view.setUint32(out.length - 4, crc32(out.subarray(0, out.length - 4)));
  return out;
}

// Header only: name, desk, version and date, for showing before opening
export function peekKk(bytes) {
  if (!isKk(bytes)) return null;
  const len = new DataView(bytes.buffer, bytes.byteOffset).getUint16(6);
  try {
    return JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + len)));
  } catch {
    return null;
  }
}

export async function readKk(bytes) {
  if (!isKk(bytes)) throw new Error("That isn't a Show Builder file.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const format = view.getUint8(4);
  if (format > FORMAT)
    throw new Error('That file was saved by a newer Show Builder. Update the app to open it.');
  if (view.getUint32(bytes.length - 4) !== crc32(bytes.subarray(0, bytes.length - 4)))
    throw new Error('That file is damaged or was cut short.');
  const len = view.getUint16(6);
  const header = peekKk(bytes);
  let body = bytes.subarray(8 + len, bytes.length - 4);
  if (view.getUint8(5) & GZIP) body = await gunzip(body);
  return { header, show: JSON.parse(new TextDecoder().decode(body)) };
}

// Opens either kind of show file: .kk, or the older JSON
export async function readShowFile(bytes) {
  if (isKk(bytes)) return readKk(bytes);
  let show;
  try {
    show = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("That isn't a Show Builder file.");
  }
  return { header: null, show };
}
