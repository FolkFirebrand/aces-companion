// Match codes: six characters, avoiding letters and digits that read alike (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

export function newMatchCode(random: () => number = Math.random): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('')
}

/** A typed-in code, cleaned up: upper case, spaces and dashes dropped. Null when it can't be a code. */
export function normalizeMatchCode(text: string): string | null {
  const code = text.toUpperCase().replace(/[\s-]/g, '')
  return code.length === CODE_LENGTH && [...code].every(c => CODE_ALPHABET.includes(c)) ? code : null
}
