// @vitest-environment node
import { expect, it } from 'vitest'
import { routeInventory } from '../../scripts/security-route-inventory.mjs'
import manifest from '../config/route-manifest.json'
import { SESSION_EXCEPTIONS } from './route-policy.js'

it('requires an explicit review when methods, routes or guards change', () => {
  expect(routeInventory()).toEqual(manifest)
}, 20_000)
it('keeps every session exception explicit and backed by an existing route', () => {
  const registered = new Set(manifest.map(row => `${row.method} ${row.path}`))
  for (const key of SESSION_EXCEPTIONS) expect(registered.has(key)).toBe(true)
  for (const row of manifest) {
    if (SESSION_EXCEPTIONS.has(`${row.method} ${row.path}`)) continue
    expect(row.guards.some(guard => guard === 'auth()' || guard === '...ownerOnly'), `${row.method} ${row.path}`).toBe(true)
  }
})
