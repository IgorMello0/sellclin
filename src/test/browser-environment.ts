// Node 25 exposes a native localStorage that can shadow JSDOM's implementation.
// Give each browser test environment an isolated implementation of Storage.
function storage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => { values.set(String(key), String(value)) },
    removeItem: key => { values.delete(String(key)) },
    key: index => [...values.keys()][index] ?? null,
  }
}
if (typeof window !== 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: storage(), configurable: true })
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage(), configurable: true })
}
