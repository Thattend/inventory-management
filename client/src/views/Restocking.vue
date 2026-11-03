<template>
  <div class="restocking">
    <div class="page-header">
      <h2>{{ t('restocking.title') }}</h2>
      <p>{{ t('restocking.description') }}</p>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="!loaded" class="error">{{ error }}</div>
    <div v-else>
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

      <div v-if="orderResult" class="banner success-banner">
        <span>{{ t('restocking.orderPlaced', { orderNumber: orderResult.order_number }) }}</span>
        <router-link to="/orders">{{ t('restocking.viewOrder') }}</router-link>
      </div>
      <div v-if="error" class="error">{{ error }}</div>

      <div class="card">
        <div class="card-header header-row">
          <h3 class="card-title">{{ t('restocking.recommendations') }} ({{ lines.length }})</h3>
          <button
            type="button"
            class="place-order"
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
.budget-layout {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 2fr;
  gap: 1.5rem;
  align-items: center;
}

.slider-label {
  display: block;
  font-size: 0.813rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.budget-slider {
  width: 100%;
  accent-color: #0f172a;
}

.slider-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #64748b;
}

.readout {
  margin-bottom: 0;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.place-order {
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.25rem;
  font-weight: 600;
  cursor: pointer;
}

.place-order:disabled {
  background: #e2e8f0;
  color: #64748b;
  cursor: not-allowed;
}

.num {
  text-align: right;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #64748b;
}

.banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.success-banner {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.success-banner a {
  color: #065f46;
  font-weight: 600;
  text-decoration: underline;
}

@media (max-width: 900px) {
  .budget-layout {
    grid-template-columns: 1fr;
  }
}
</style>
