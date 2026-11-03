/**
 * Unit tests for client/src/composables/useLatestLoad.js.
 * Run from the repo root: node --test tests/frontend/useLatestLoad.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useLatestLoad } from '../../client/src/composables/useLatestLoad.js'

// A promise the test resolves or rejects by hand, to control response order
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const describeError = (err) => 'Failed to load: ' + err.message

test('starts in the initial loading state', () => {
  const state = useLatestLoad({ describeError })
  assert.equal(state.loading.value, true)
  assert.equal(state.refreshing.value, false)
  assert.equal(state.error.value, null)
})

test('a successful run applies the result and ends loading', async () => {
  const state = useLatestLoad({ describeError })
  let applied = null
  const ok = await state.run(async () => 42, (value) => { applied = value })
  assert.equal(ok, true)
  assert.equal(applied, 42)
  assert.equal(state.loading.value, false)
  assert.equal(state.refreshing.value, false)
  assert.equal(state.error.value, null)
})

test('a later request wins even when the earlier one answers last', async () => {
  const state = useLatestLoad({ describeError })
  const tokyo = deferred()
  const london = deferred()
  const applied = []

  const first = state.run(() => tokyo.promise, (v) => applied.push(v))
  const second = state.run(() => london.promise, (v) => applied.push(v))

  london.resolve('london')
  assert.equal(await second, true)
  tokyo.resolve('tokyo') // arrives late: must be ignored
  assert.equal(await first, false)

  assert.deepEqual(applied, ['london'])
  assert.equal(state.loading.value, false)
})

test('a stale response does not end the loading state of the newer request', async () => {
  const state = useLatestLoad({ describeError })
  const first = deferred()
  const second = deferred()

  const p1 = state.run(() => first.promise, () => {})
  const p2 = state.run(() => second.promise, () => {})

  first.resolve('a')
  await p1
  assert.equal(state.loading.value, true, 'newer request is still running')

  second.resolve('b')
  await p2
  assert.equal(state.loading.value, false)
})

test('a failed request sets a readable error message', async () => {
  const state = useLatestLoad({ describeError })
  const ok = await state.run(async () => { throw new Error('status 500') }, () => {})
  assert.equal(ok, false)
  assert.equal(state.error.value, 'Failed to load: status 500')
  assert.equal(state.loading.value, false)
})

test('the error is cleared as soon as the next request starts', async () => {
  const state = useLatestLoad({ describeError })
  await state.run(async () => { throw new Error('boom') }, () => {})
  assert.ok(state.error.value)

  const pending = deferred()
  const next = state.run(() => pending.promise, () => {})
  assert.equal(state.error.value, null, 'stale error must not outlive a new attempt')
  pending.resolve('ok')
  await next
  assert.equal(state.error.value, null)
})

test('recovers after an error: a successful request shows content again', async () => {
  const state = useLatestLoad({ describeError })
  let applied = null
  await state.run(async () => { throw new Error('boom') }, () => {})
  await state.run(async () => 'rows', (v) => { applied = v })
  assert.equal(applied, 'rows')
  assert.equal(state.error.value, null)
  assert.equal(state.loading.value, false)
})

test('an error from a stale request is ignored', async () => {
  const state = useLatestLoad({ describeError })
  const slowFailure = deferred()
  const fast = deferred()

  const p1 = state.run(() => slowFailure.promise, () => {})
  const p2 = state.run(() => fast.promise, () => {})

  fast.resolve('fine')
  await p2
  slowFailure.reject(new Error('late failure'))
  await p1

  assert.equal(state.error.value, null)
})

test('after the first success, later requests are refreshes, not initial loads', async () => {
  const state = useLatestLoad({ describeError })
  await state.run(async () => 1, () => {})

  const pending = deferred()
  const next = state.run(() => pending.promise, () => {})
  // Content stays on screen while new data loads
  assert.equal(state.loading.value, false)
  assert.equal(state.refreshing.value, true)

  pending.resolve(2)
  await next
  assert.equal(state.refreshing.value, false)
})

test('after a failure the next request is an initial load again', async () => {
  // The stale rows on screen belong to an older filter, so they must not be
  // shown while the retry runs.
  const state = useLatestLoad({ describeError })
  await state.run(async () => 1, () => {})
  await state.run(async () => { throw new Error('boom') }, () => {})

  const pending = deferred()
  const retry = state.run(() => pending.promise, () => {})
  assert.equal(state.loading.value, true)
  assert.equal(state.refreshing.value, false)
  pending.resolve(3)
  await retry
})

test('apply is not called when the request fails', async () => {
  const state = useLatestLoad({ describeError })
  let calls = 0
  await state.run(async () => { throw new Error('x') }, () => { calls += 1 })
  assert.equal(calls, 0)
})

test('an error thrown while applying the result is reported, not swallowed', async () => {
  const state = useLatestLoad({ describeError })
  const ok = await state.run(async () => 'data', () => { throw new Error('bad shape') })
  assert.equal(ok, false)
  assert.equal(state.error.value, 'Failed to load: bad shape')
})

test('invalidate() makes an in-flight request stale (used on unmount)', async () => {
  const state = useLatestLoad({ describeError })
  const pending = deferred()
  let applied = false
  const p = state.run(() => pending.promise, () => { applied = true })
  state.invalidate()
  pending.resolve('late')
  assert.equal(await p, false)
  assert.equal(applied, false)
})
