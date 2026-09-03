/** UTF-8 без Encoding API: в песочнице Figma нет TextDecoder. */

const FROM_CHAR_CHUNK = 0x2000;

function flushCodeUnits(out: string[], chunk: number[]): void {
  if (!chunk.length) return;
  out.push(String.fromCharCode.apply(null, chunk));
  chunk.length = 0;
}

export function utf8BytesToString(bytes: Uint8Array): string {
  const out: string[] = [];
  const chunk: number[] = [];

  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      chunk.push(b0);
    } else if (b0 < 0xe0) {
      const b1 = bytes[i++];
      chunk.push(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if (b0 < 0xf0) {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      chunk.push(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      let cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      cp -= 0x10000;
      chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
    if (chunk.length >= FROM_CHAR_CHUNK) flushCodeUnits(out, chunk);
  }

  flushCodeUnits(out, chunk);
  return out.join("");
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const table =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const output: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (table.indexOf(clean[i]) << 18) |
      (table.indexOf(clean[i + 1]) << 12) |
      ((table.indexOf(clean[i + 2]) & 63) << 6) |
      (table.indexOf(clean[i + 3]) & 63);
    output.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  const pad = (base64.match(/=+$/) ?? [""])[0].length;
  if (pad) output.length -= pad;
  return Uint8Array.from(output);
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  return decodeBase64(base64);
}
