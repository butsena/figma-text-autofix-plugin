import { gzip, inflate } from "pako";

/** Gzip .aff+.dic в base64. Выше — не пишем в clientStorage (лимит Figma 5 MB). */
export const MAX_SPELL_DICTIONARY_CACHE_CHARS = 4_000_000;

/**
 * Без ETag повторно качаем .dic не чаще раза в сутки.
 * В Figma заголовок ETag не читается, поэтому условный GET там не срабатывает.
 */
export const SPELL_DICTIONARY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY = "hunspell-ru-cache-v1";

export type SpellDictionaryCacheRecord = {
  etagAff: string | null;
  etagDic: string | null;
  hashAff: string;
  hashDic: string;
  affGzipB64: string;
  dicGzipB64: string;
  /** Когда копию положили в кэш. Нет поля — старая запись, её ещё можно использовать. */
  savedAt?: number;
};

export type SpellDictionaryCacheStore = {
  get(): Promise<SpellDictionaryCacheRecord | null>;
  set(record: SpellDictionaryCacheRecord): Promise<void>;
};

export function hashText(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x811c9dc5);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

/** UTF-8 без TextEncoder: в песочнице Figma его нет, а pako зовёт его для строки. */
function encodeUtf8(text: string): Uint8Array {
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) length += 1;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      length += 4;
      i += 1;
    } else length += 3;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      bytes[offset++] = code;
    } else if (code < 0x800) {
      bytes[offset++] = 0xc0 | (code >> 6);
      bytes[offset++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      bytes[offset++] = 0xe0 | (code >> 12);
      bytes[offset++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[offset++] = 0x80 | (code & 0x3f);
    } else {
      bytes[offset++] = 0xf0 | (code >> 18);
      bytes[offset++] = 0x80 | ((code >> 12) & 0x3f);
      bytes[offset++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[offset++] = 0x80 | (code & 0x3f);
    }
  }
  return bytes;
}

function decodeUtf8(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i] ?? 0;
    if (b0 < 0x80) {
      result += String.fromCharCode(b0);
      i += 1;
    } else if (b0 < 0xe0) {
      const b1 = bytes[i + 1] ?? 0;
      result += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
      i += 2;
    } else if (b0 < 0xf0) {
      const b1 = bytes[i + 1] ?? 0;
      const b2 = bytes[i + 2] ?? 0;
      result += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
      i += 3;
    } else {
      const b1 = bytes[i + 1] ?? 0;
      const b2 = bytes[i + 2] ?? 0;
      const b3 = bytes[i + 3] ?? 0;
      const code =
        ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      const shifted = code - 0x10000;
      result += String.fromCharCode(0xd800 + (shifted >> 10), 0xdc00 + (shifted & 0x3ff));
      i += 4;
    }
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    let part = "";
    for (let j = i; j < end; j++) part += String.fromCharCode(bytes[j] ?? 0);
    binary += part;
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function compressText(text: string): string {
  return bytesToBase64(gzip(encodeUtf8(text)));
}

function decompressText(b64: string): string {
  const inflated = inflate(base64ToBytes(b64));
  if (!(inflated instanceof Uint8Array)) {
    throw new Error("spell dictionary cache: expected bytes");
  }
  return decodeUtf8(inflated);
}

export function packSpellDictionary(
  aff: string,
  dic: string,
  etagAff: string | null,
  etagDic: string | null,
): SpellDictionaryCacheRecord | null {
  const affGzipB64 = compressText(aff);
  const dicGzipB64 = compressText(dic);
  if (affGzipB64.length + dicGzipB64.length > MAX_SPELL_DICTIONARY_CACHE_CHARS) {
    console.warn(
      "[text-autofix] spell dictionary cache skipped, gzip too large",
      affGzipB64.length + dicGzipB64.length,
    );
    return null;
  }
  return {
    etagAff,
    etagDic,
    hashAff: hashText(aff),
    hashDic: hashText(dic),
    affGzipB64,
    dicGzipB64,
    savedAt: Date.now(),
  };
}

/** Локальная копия без ETag и моложе суток — сеть не нужна. */
export function spellDictionaryCacheSkipsNetwork(
  record: SpellDictionaryCacheRecord,
  now = Date.now(),
): boolean {
  if (record.etagAff || record.etagDic) return false;
  if (record.savedAt == null) return true;
  return now - record.savedAt < SPELL_DICTIONARY_CACHE_TTL_MS;
}

export function unpackSpellDictionary(
  record: SpellDictionaryCacheRecord,
): { aff: string; dic: string } | null {
  try {
    const aff = decompressText(record.affGzipB64);
    const dic = decompressText(record.dicGzipB64);
    if (hashText(aff) !== record.hashAff || hashText(dic) !== record.hashDic) return null;
    if (!aff || !dic) return null;
    return { aff, dic };
  } catch (error) {
    console.warn("[text-autofix] spell dictionary cache unpack failed", error);
    return null;
  }
}

function isCacheRecord(value: unknown): value is SpellDictionaryCacheRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as SpellDictionaryCacheRecord;
  return (
    typeof record.affGzipB64 === "string" &&
    typeof record.dicGzipB64 === "string" &&
    typeof record.hashAff === "string" &&
    typeof record.hashDic === "string" &&
    (record.etagAff === null || typeof record.etagAff === "string") &&
    (record.etagDic === null || typeof record.etagDic === "string") &&
    (record.savedAt === undefined || typeof record.savedAt === "number")
  );
}

export function getFigmaSpellDictionaryCacheStore(): SpellDictionaryCacheStore | null {
  if (typeof figma === "undefined" || !figma.clientStorage) return null;
  return {
    async get() {
      try {
        const value = await figma.clientStorage.getAsync(STORAGE_KEY);
        return isCacheRecord(value) ? value : null;
      } catch (error) {
        console.warn("[text-autofix] spell dictionary cache read failed", error);
        return null;
      }
    },
    async set(record) {
      try {
        await figma.clientStorage.setAsync(STORAGE_KEY, record);
      } catch (error) {
        console.warn("[text-autofix] spell dictionary cache write failed", error);
      }
    },
  };
}

export function createMemorySpellDictionaryCache(): SpellDictionaryCacheStore & {
  snapshot(): SpellDictionaryCacheRecord | null;
} {
  let record: SpellDictionaryCacheRecord | null = null;
  return {
    async get() {
      return record;
    },
    async set(next) {
      record = next;
    },
    snapshot() {
      return record;
    },
  };
}
