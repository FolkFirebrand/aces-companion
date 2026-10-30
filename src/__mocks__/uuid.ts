let counter = 0

export function v4(): string {
  return `test-uuid-${++counter}`
}
