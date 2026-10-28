/**
 * Generator ID unik untuk renderer.
 *
 * crypto.randomUUID() dipakai kalau tersedia; kalau tidak (webview lama / env
 * tanpa Web Crypto), fallback ke Math.random().toString(36) + counter supaya
 * dua ID dalam milidetik yang sama tidak pernah bentrok.
 */

let fallbackCounter = 0

export function createId(prefix: string): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${(fallbackCounter += 1).toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`

  return `${prefix}-${uuid}`
}

