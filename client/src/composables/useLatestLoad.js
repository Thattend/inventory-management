import { computed, ref } from 'vue'

/**
 * Loading state for data that is re-fetched when filters change.
 *
 * Fixes three problems of the plain "loading / error refs + await" pattern:
 *  1. Stale responses: with two quick filter changes the slower, OLDER request
 *     could answer last and overwrite the newer data (Tokyo rows under a London
 *     filter). Only the most recent request may apply its result.
 *  2. Stale errors: an error was never cleared, so a page stayed broken until
 *     reload even after the API recovered. The error is cleared when a new
 *     request starts.
 *  3. Page flash: every filter change replaced the whole page with "Loading...".
 *     After the first successful load the old content stays on screen and only
 *     `refreshing` turns on.
 *
 * Usage:
 *   const { loading, refreshing, error, run } = useLatestLoad({
 *     describeError: (err) => 'Failed to load orders: ' + err.message
 *   })
 *   const load = () => run(() => api.getOrders(filters), (rows) => { orders.value = rows })
 *
 *   loading    - true until the first success (and again after a failure while
 *                the retry runs): show the full-page loading placeholder
 *   refreshing - true while re-fetching with content already on screen: dim it
 *   error      - message of the last failed request, or null
 */
export function useLatestLoad({ describeError = (err) => err.message } = {}) {
  // Incremented per request; a request is current only if no newer one started
  let latestTicket = 0
  const inFlight = ref(false)
  const loaded = ref(false)
  const error = ref(null)

  const loading = computed(() => !loaded.value && !error.value)
  const refreshing = computed(() => loaded.value && inFlight.value)

  const isCurrent = (ticket) => ticket === latestTicket

  /**
   * Run `task`, then pass its result to `apply` - unless a newer run started
   * in the meantime. Returns true only if this run's result was applied.
   * `apply` stays free of async code so state updates happen in one step.
   */
  const run = async (task, apply) => {
    latestTicket += 1
    const ticket = latestTicket
    inFlight.value = true
    error.value = null
    try {
      const result = await task()
      if (!isCurrent(ticket)) return false
      apply(result)
      loaded.value = true
      return true
    } catch (err) {
      if (!isCurrent(ticket)) return false
      error.value = describeError(err)
      // Rows on screen belong to an older filter: do not show them while the
      // user retries.
      loaded.value = false
      return false
    } finally {
      if (isCurrent(ticket)) inFlight.value = false
    }
  }

  /** Make any in-flight request stale (call from onBeforeUnmount). */
  const invalidate = () => {
    latestTicket += 1
    inFlight.value = false
  }

  return { loading, refreshing, error, run, invalidate }
}
