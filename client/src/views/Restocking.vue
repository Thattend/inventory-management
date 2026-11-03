<template>
  <div class="restocking">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('restocking.title') }}</h2>
        <p class="page-description">{{ t('restocking.description') }}</p>
      </div>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="!loaded" class="error">{{ error }}</div>
    <div v-else class="page-sections">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('restocking.budgetTitle') }}</h3>
        </div>
        <div class="budget-layout">
          <div class="slider-block">
            <label class="slider-label" for="budget-slider">{{ t('restocking.budget') }}</label>
            <input
              id="budget-slider"
              type="range"
              class="budget-slider"
              min="0"
              :max="sliderMax"
              :step="BUDGET_STEP"
              v-model.number="budget"
            />
            <div class="slider-scale">
              <span>{{ formatCurrency(0, currentCurrency) }}</span>
              <span>{{ formatCurrency(sliderMax, currentCurrency) }}</span>
            </div>
          </div>
          <div class="stats-grid readout">
            <div class="stat-card info">
              <div class="stat-label">{{ t('restocking.budget') }}</div>
              <div class="stat-value">{{ formatCurrency(budget, currentCurrency) }}</div>
            </div>
            <div class="stat-card success">
              <div class="stat-label">{{ t('restocking.total') }}</div>
              <div class="stat-value">{{ formatCurrencyWithDecimals(totalCost, currentCurrency, 2) }}</div>
            </div>
            <div class="stat-card warning">
              <div class="stat-label">{{ t('restocking.remaining') }}</div>
              <div class="stat-value">{{ formatCurrencyWithDecimals(remainingBudget, currentCurrency, 2) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('restocking.leadTime') }}</div>
              <div class="stat-value">{{ t('restocking.days', { days: orderLeadTime }) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="orderResult" class="banner success-banner" role="status">
        <span>{{ t('restocking.orderPlaced', { orderNumber: orderResult.order_number }) }}</span>
        <router-link to="/orders">{{ t('restocking.viewOrder') }}</router-link>
      </div>
      <div v-if="error" class="error">{{ error }}</div>

      <!-- Flush card: the table runs edge to edge; header padding comes from .card--flush -->
      <div class="card card--flush">
        <div class="card-header">
          <h3 class="card-title">{{ t('restocking.recommendations') }} ({{ lines.length }})</h3>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="lines.length === 0 || submitting || refreshing"
            @click="placeOrder"
          >
            {{ submitting ? t('restocking.submitting') : t('restocking.placeOrder') }}
          </button>
        </div>

        <div v-if="lines.length === 0" class="empty-state">{{ t('restocking.empty') }}</div>
        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t('restocking.table.sku') }}</th>
                <th>{{ t('restocking.table.item') }}</th>
                <th>{{ t('restocking.table.trend') }}</th>
                <th class="num">{{ t('restocking.table.quantity') }}</th>
                <th class="num">{{ t('restocking.table.unitCost') }}</th>
                <th class="num">{{ t('restocking.table.lineTotal') }}</th>
                <th class="num">{{ t('restocking.table.leadTime') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in lines" :key="line.sku">
                <td><strong>{{ line.sku }}</strong></td>
                <td>{{ translateProductName(line.name) }}</td>
                <td>
                  <span :class="['badge', getTrendClass(line.trend)]">{{ getTrendLabel(line.trend) }}</span>
                </td>
                <td class="num">{{ line.quantity.toLocaleString() }}</td>
                <td class="num">{{ formatCurrencyWithDecimals(line.unit_cost, currentCurrency, 2) }}</td>
                <td class="num"><strong>{{ formatCurrencyWithDecimals(line.line_total, currentCurrency, 2) }}</strong></td>
                <td class="num">{{ t('restocking.days', { days: line.lead_time_days }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'
import { formatCurrency, formatCurrencyWithDecimals } from '../utils/currency'

const BUDGET_STEP = 500
const INITIAL_BUDGET = 5000
const DEBOUNCE_MS = 250

// Trend -> existing badge colour class (increasing green, stable blue, decreasing yellow)
const TREND_CLASSES = { increasing: 'success', stable: 'info', decreasing: 'warning' }

export default {
  name: 'Restocking',
  setup() {
    const { t, currentCurrency, translateProductName } = useI18n()

    const loading = ref(true)
    const loaded = ref(false)
    const refreshing = ref(false)
    const submitting = ref(false)
    const error = ref(null)
    const orderResult = ref(null)

    const budget = ref(INITIAL_BUDGET)
    const maxUsefulBudget = ref(0)
    const lines = ref([])
    const totalCost = ref(0)
    const remainingBudget = ref(0)

    // Slider max is rounded up to the step so the full useful budget is reachable
    const sliderMax = computed(() => Math.ceil(maxUsefulBudget.value / BUDGET_STEP) * BUDGET_STEP)

    // An order ships together, so it arrives when its slowest line does
    const orderLeadTime = computed(() =>
      lines.value.reduce((max, line) => Math.max(max, line.lead_time_days), 0)
    )

    let debounceTimer = null
    let requestCounter = 0

    const loadRecommendations = async (budgetValue, { initial = false } = {}) => {
      // Out-of-order guard: while the user drags, several requests can be in flight and
      // a slower, older one may resolve after a newer one. Each call takes a ticket and
      // only the response holding the latest ticket may update state; stale ones are dropped.
      const ticket = ++requestCounter
      refreshing.value = true
      try {
        const data = await api.getRestockRecommendations(budgetValue)
        if (ticket !== requestCounter) return
        lines.value = data.lines
        totalCost.value = data.total_cost
        remainingBudget.value = data.remaining_budget
        error.value = null
        if (initial) {
          // Only the first response defines the slider range, so it stays stable while dragging
          maxUsefulBudget.value = data.max_useful_budget
          budget.value = Math.min(budgetValue, sliderMax.value)
          loaded.value = true
        }
      } catch (err) {
        if (ticket !== requestCounter) return
        console.error('Restock recommendations error:', err)
        error.value = t('restocking.loadError')
      } finally {
        if (ticket === requestCounter) {
          refreshing.value = false
          loading.value = false
        }
      }
    }

    // Debounce slider input: restart the timer on every change, call API once it settles
    watch(budget, (value) => {
      if (!loaded.value) return
      orderResult.value = null
      refreshing.value = true // keep Place Order disabled while the table is stale
      // Invalidate any request already in flight: if it resolved during the debounce
      // window it would re-enable Place Order while the table shows the old budget.
      requestCounter++
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => loadRecommendations(value), DEBOUNCE_MS)
    })

    const placeOrder = async () => {
      submitting.value = true
      error.value = null
      orderResult.value = null
      try {
        orderResult.value = await api.createRestockOrder(budget.value)
      } catch (err) {
        console.error('Restock order error:', err)
        error.value = err.response?.data?.detail || t('restocking.submitError')
      } finally {
        submitting.value = false
      }
    }

    const getTrendClass = (trend) => TREND_CLASSES[trend] || 'info'
    const getTrendLabel = (trend) => {
      const key = `trends.${trend}`
      const label = t(key)
      return label === key ? trend : label // fall back to raw value for unknown trends
    }

    onMounted(() => loadRecommendations(INITIAL_BUDGET, { initial: true }))
    onBeforeUnmount(() => clearTimeout(debounceTimer))

    return {
      t,
      BUDGET_STEP,
      currentCurrency,
      translateProductName,
      formatCurrency,
      formatCurrencyWithDecimals,
      loading,
      loaded,
      refreshing,
      submitting,
      error,
      orderResult,
      budget,
      sliderMax,
      lines,
      totalCost,
      remainingBudget,
      orderLeadTime,
      placeOrder,
      getTrendClass,
      getTrendLabel
    }
  }
}
</script>

<style scoped>
/* Page header, cards, stat tiles, tables, badges, buttons and states come from styles/base.css. */

/* Vertical rhythm: one gap between sections instead of per-element margins */
.page-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.page-sections > * {
  margin: 0;
}

/* Slider on the left, readout tiles on the right; stacks below 900px (see media query) */
.budget-layout {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 2fr;
  gap: var(--space-6);
  align-items: center;
}

.slider-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.budget-slider {
  width: 100%;
  accent-color: var(--color-primary);
}

.slider-scale {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

/* Readout tiles sit inside the budget card, so drop the grid's own bottom margin */
.readout {
  margin-bottom: 0;
}

.banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
}

/* No --color-success-border token exists yet; derive a light border from the success color */
.success-banner {
  background: var(--color-success-soft);
  color: var(--color-success-text);
  border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
}

.success-banner a {
  color: var(--color-success-text);
  font-weight: var(--weight-semibold);
  text-decoration: underline;
}

@media (max-width: 900px) {
  .budget-layout {
    grid-template-columns: 1fr;
  }
}
</style>
