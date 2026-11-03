<template>
  <div class="spending">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('finance.title') }}</h2>
        <p class="page-description">{{ t('finance.description') }}</p>
      </div>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <!-- .page-sections owns the vertical rhythm (gap) so cards/grids need no ad-hoc margins -->
    <div v-else class="page-sections">
      <!-- Revenue & Financial KPIs -->
      <div class="stats-grid">
        <div class="stat-card revenue-card">
          <div class="stat-label">{{ t('finance.totalRevenue') }}</div>
          <div class="stat-value">{{ formatCurrency(revenueMetrics.totalRevenue) }}</div>
          <div class="stat-meta stat-change positive">
            <span class="change-icon" aria-hidden="true">↑</span>
            {{ t('finance.fromOrders', { count: revenueMetrics.orderCount }) }}
          </div>
        </div>
        <div class="stat-card cost-card">
          <div class="stat-label">{{ t('finance.totalCosts') }}</div>
          <div class="stat-value">{{ formatCurrency(totalCosts) }}</div>
          <div class="stat-meta">{{ t('finance.costBreakdown') }}</div>
        </div>
        <div class="stat-card profit-card">
          <div class="stat-label">{{ t('finance.netProfit') }}</div>
          <div class="stat-value">{{ formatCurrency(netProfit) }}</div>
          <div class="stat-meta">{{ profitMargin }}% {{ t('finance.margin') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('finance.avgOrderValue') }}</div>
          <div class="stat-value">{{ formatCurrency(revenueMetrics.avgOrderValue) }}</div>
          <div class="stat-meta">{{ t('finance.perOrderRevenue') }}</div>
        </div>
      </div>

      <!-- Monthly Revenue vs Cost Chart -->
      <div class="card chart-card">
        <div class="card-header">
          <h3 class="card-title">{{ t('finance.revenueVsCosts.title') }}</h3>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-dot revenue-color"></span>{{ t('finance.revenueVsCosts.revenue') }}</span>
            <span class="legend-item"><span class="legend-dot cost-color"></span>{{ t('finance.revenueVsCosts.costs') }}</span>
          </div>
        </div>
        <div class="chart-container">
          <div class="bar-chart">
            <div class="y-axis">
              <span>{{ currencySymbol }}{{ maxRevenueValue }}K</span>
              <span>{{ currencySymbol }}{{ Math.round(maxRevenueValue * 0.75) }}K</span>
              <span>{{ currencySymbol }}{{ Math.round(maxRevenueValue * 0.5) }}K</span>
              <span>{{ currencySymbol }}{{ Math.round(maxRevenueValue * 0.25) }}K</span>
              <span>{{ currencySymbol }}0</span>
            </div>
            <div class="chart-area">
              <div v-for="month in monthlyRevenue" :key="month.month" class="bar-group-revenue">
                <div class="revenue-bars">
                  <div class="revenue-bar" :style="{ height: getRevenueBarHeight(month.revenue) + '%' }" :title="`Revenue: ${currencySymbol}${month.revenue.toLocaleString()}`"></div>
                  <div class="cost-bar" :style="{ height: getRevenueBarHeight(month.costs) + '%' }" :title="`Costs: ${currencySymbol}${month.costs.toLocaleString()}`"></div>
                </div>
                <span class="bar-label">{{ translateMonth(month.month) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Monthly Cost Flow Chart -->
      <div class="card chart-card">
        <div class="card-header">
          <h3 class="card-title">{{ t('finance.monthlyCostFlow.title') }}</h3>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-dot procurement"></span>{{ t('finance.monthlyCostFlow.procurement') }}</span>
            <span class="legend-item"><span class="legend-dot operational"></span>{{ t('finance.monthlyCostFlow.operational') }}</span>
            <span class="legend-item"><span class="legend-dot labor"></span>{{ t('finance.monthlyCostFlow.labor') }}</span>
            <span class="legend-item"><span class="legend-dot overhead"></span>{{ t('finance.monthlyCostFlow.overhead') }}</span>
          </div>
        </div>
        <div class="chart-container">
          <div class="bar-chart">
            <div class="y-axis">
              <span>{{ currencySymbol }}25K</span>
              <span>{{ currencySymbol }}20K</span>
              <span>{{ currencySymbol }}15K</span>
              <span>{{ currencySymbol }}10K</span>
              <span>{{ currencySymbol }}5K</span>
              <span>{{ currencySymbol }}0</span>
            </div>
            <div class="chart-area">
              <div v-for="month in monthlySpending" :key="month.month" class="bar-group">
                <div class="stacked-bar" @click="showCostDetail(month)">
                  <div class="bar-segment procurement" :style="{ height: getBarHeight(month.procurement) + '%' }" :title="`Procurement: ${currencySymbol}${month.procurement.toLocaleString()}`"></div>
                  <div class="bar-segment operational" :style="{ height: getBarHeight(month.operational) + '%' }" :title="`Operational: ${currencySymbol}${month.operational.toLocaleString()}`"></div>
                  <div class="bar-segment labor" :style="{ height: getBarHeight(month.labor) + '%' }" :title="`Labor: ${currencySymbol}${month.labor.toLocaleString()}`"></div>
                  <div class="bar-segment overhead" :style="{ height: getBarHeight(month.overhead) + '%' }" :title="`Overhead: ${currencySymbol}${month.overhead.toLocaleString()}`"></div>
                </div>
                <span class="bar-label">{{ translateMonth(month.month) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="two-column-grid">
        <!-- Category Spending Breakdown -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">{{ t('finance.categorySpending.title') }}</h3>
          </div>
          <div class="category-list">
            <div v-for="category in categorySpending" :key="category.category" class="category-item">
              <div class="category-info">
                <div class="category-name">{{ translateCategory(category.category) }}</div>
                <div class="category-amount">{{ currencySymbol }}{{ category.amount.toLocaleString() }}</div>
              </div>
              <div class="category-bar-container">
                <div class="category-bar" :style="{ width: category.percentage + '%' }"></div>
              </div>
              <div class="category-meta">
                <span class="percentage">{{ category.percentage }}% {{ t('finance.categorySpending.ofTotal') }}</span>
                <span class="change" :class="{ positive: category.change > 0, negative: category.change < 0 }">
                  {{ category.change > 0 ? '+' : '' }}{{ category.change }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="card transactions-card">
          <div class="card-header">
            <h3 class="card-title">{{ t('finance.transactions.title') }}</h3>
          </div>
          <div v-if="recentTransactions.length === 0" class="empty-state">{{ t('common.noData') }}</div>
          <!-- Fixed max-height makes the container the scroll box, so the shared sticky th sticks inside the card -->
          <div v-else class="table-container transactions-table-container">
            <table>
              <thead>
                <tr>
                  <th>{{ t('finance.transactions.id') }}</th>
                  <th>{{ t('finance.transactions.description') }}</th>
                  <th>{{ t('finance.transactions.vendor') }}</th>
                  <th>{{ t('finance.transactions.date') }}</th>
                  <th class="num">{{ t('finance.transactions.amount') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="transaction in recentTransactions"
                  :key="transaction.id"
                  class="clickable-row"
                  @click="handleTransactionClick(transaction)"
                >
                  <td class="transaction-id">{{ transaction.id.toString().padStart(3, '0') }}</td>
                  <td class="transaction-description">{{ transaction.description }}</td>
                  <td class="transaction-vendor">{{ transaction.vendor }}</td>
                  <td class="transaction-date">{{ formatDateShort(transaction.date) }}</td>
                  <td class="transaction-amount num">{{ currencySymbol }}{{ transaction.amount.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <CostDetailModal
      :is-open="showCostModal"
      :cost-data="selectedCostData"
      @close="showCostModal = false"
    />
  </div>
</template>

<script>
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '../api'
import { useFilters } from '../composables/useFilters'
import { useI18n } from '../composables/useI18n'
import { formatCurrency as formatCurrencyUtil } from '../utils/currency'
import CostDetailModal from '../components/CostDetailModal.vue'

export default {
  name: 'Spending',
  components: {
    CostDetailModal
  },
  setup() {
    const { t, currentCurrency } = useI18n()
    const loading = ref(true)
    const error = ref(null)
    const allMonthlySpending = ref([])
    const allCategorySpending = ref([])
    const allTransactions = ref([])
    const summaryData = ref({})
    const allOrders = ref([])

    // Modal state
    const showCostModal = ref(false)
    const selectedCostData = ref(null)

    // Use shared filters
    const { selectedPeriod, getCurrentFilters } = useFilters()

    // Monthly spending chart always shows all months (not filtered)
    const monthlySpending = computed(() => {
      return allMonthlySpending.value
    })

    // Filtered monthly spending for summary calculations only
    const filteredMonthlySpending = computed(() => {
      if (selectedPeriod.value === 'all') {
        return allMonthlySpending.value
      }

      // Extract month name from YYYY-MM format
      const monthMap = {
        '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
        '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
        '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
      }
      const selectedMonth = monthMap[selectedPeriod.value.split('-')[1]]
      return allMonthlySpending.value.filter(m => m.month === selectedMonth)
    })

    const categorySpending = computed(() => {
      return allCategorySpending.value
    })

    const recentTransactions = computed(() => {
      if (selectedPeriod.value === 'all') {
        return allTransactions.value
      }
      // Filter transactions by selected month
      return allTransactions.value.filter(t => {
        const transactionMonth = new Date(t.date).toISOString().slice(0, 7)
        return transactionMonth === selectedPeriod.value
      })
    })

    const summary = computed(() => {
      // Recalculate summary based on filteredMonthlySpending (not the chart data)
      if (filteredMonthlySpending.value.length === 0) {
        return summaryData.value
      }

      const totals = filteredMonthlySpending.value.reduce((acc, month) => ({
        procurement: acc.procurement + month.procurement,
        operational: acc.operational + month.operational,
        labor: acc.labor + month.labor,
        overhead: acc.overhead + month.overhead
      }), { procurement: 0, operational: 0, labor: 0, overhead: 0 })

      return {
        total_procurement_cost: totals.procurement,
        total_operational_cost: totals.operational,
        total_labor_cost: totals.labor,
        total_overhead: totals.overhead,
        procurement_change: summaryData.value.procurement_change || 0,
        operational_change: summaryData.value.operational_change || 0,
        labor_change: summaryData.value.labor_change || 0,
        overhead_change: summaryData.value.overhead_change || 0
      }
    })

    // Filtered orders based on selected period
    const filteredOrders = computed(() => {
      if (selectedPeriod.value === 'all') {
        return allOrders.value
      }

      // Filter orders by selected month
      return allOrders.value.filter(order => {
        const orderMonth = new Date(order.order_date).toISOString().slice(0, 7)
        return orderMonth === selectedPeriod.value
      })
    })

    // Revenue metrics from filtered orders
    const revenueMetrics = computed(() => {
      const totalRevenue = filteredOrders.value.reduce((sum, order) => sum + (order.total_value || 0), 0)
      const orderCount = filteredOrders.value.length
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0

      return {
        totalRevenue,
        orderCount,
        avgOrderValue,
        revenueGrowth: 15.3 // Placeholder - could calculate from historical data
      }
    })

    // Total costs from summary
    const totalCosts = computed(() => {
      return summary.value.total_procurement_cost +
             summary.value.total_operational_cost +
             summary.value.total_labor_cost +
             summary.value.total_overhead
    })

    // Net profit
    const netProfit = computed(() => {
      return revenueMetrics.value.totalRevenue - totalCosts.value
    })

    // Profit margin percentage
    const profitMargin = computed(() => {
      if (revenueMetrics.value.totalRevenue === 0) return 0
      return ((netProfit.value / revenueMetrics.value.totalRevenue) * 100).toFixed(1)
    })

    // Monthly revenue data for chart
    const monthlyRevenue = computed(() => {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      // Initialize all months
      const revenueByMonth = monthNames.map(month => ({
        month,
        revenue: 0,
        costs: 0
      }))

      // Calculate revenue from orders
      allOrders.value.forEach(order => {
        const orderDate = new Date(order.order_date)
        const monthIndex = orderDate.getMonth()
        if (monthIndex >= 0 && monthIndex < 12) {
          revenueByMonth[monthIndex].revenue += order.total_value || 0
        }
      })

      // Add costs from spending data
      allMonthlySpending.value.forEach(spending => {
        const monthIndex = monthNames.indexOf(spending.month)
        if (monthIndex >= 0) {
          revenueByMonth[monthIndex].costs = spending.procurement + spending.operational + spending.labor + spending.overhead
        }
      })

      return revenueByMonth
    })

    // Max value for chart scaling
    const maxRevenueValue = computed(() => {
      const maxRevenue = Math.max(...monthlyRevenue.value.map(m => m.revenue))
      const maxCost = Math.max(...monthlyRevenue.value.map(m => m.costs))
      const max = Math.max(maxRevenue, maxCost)
      return Math.ceil(max / 1000) // Return in K
    })

    const loadData = async () => {
      try {
        loading.value = true
        const [summaryRes, monthlyRes, categoryRes, transactionsRes, ordersRes] = await Promise.all([
          api.getSpendingSummary(),
          api.getMonthlySpending(),
          api.getCategorySpending(),
          api.getTransactions(),
          api.getOrders()
        ])

        summaryData.value = summaryRes
        allMonthlySpending.value = monthlyRes
        allCategorySpending.value = categoryRes
        allTransactions.value = transactionsRes
        allOrders.value = ordersRes
      } catch (err) {
        error.value = 'Failed to load financial data: ' + err.message
      } finally {
        loading.value = false
      }
    }

    // Watch for period filter changes
    watch([selectedPeriod], () => {
      // Data will automatically update via computed properties
    })

    const formatCurrency = (value) => {
      return formatCurrencyUtil(value, currentCurrency.value)
    }

    const currencySymbol = computed(() => {
      return currentCurrency.value === 'JPY' ? '¥' : '$'
    })

    const getBarHeight = (value) => {
      const maxValue = 25000
      return (value / maxValue) * 100
    }

    const getRevenueBarHeight = (value) => {
      const maxValue = maxRevenueValue.value * 1000
      return (value / maxValue) * 100
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }

    const formatDateShort = (dateString) => {
      const date = new Date(dateString)
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const year = date.getFullYear().toString().slice(-2)
      return `${month}/${day}/${year}`
    }

    const translateMonth = (month) => {
      const monthMap = {
        'Jan': t('months.jan'),
        'Feb': t('months.feb'),
        'Mar': t('months.mar'),
        'Apr': t('months.apr'),
        'May': t('months.may'),
        'Jun': t('months.jun'),
        'Jul': t('months.jul'),
        'Aug': t('months.aug'),
        'Sep': t('months.sep'),
        'Oct': t('months.oct'),
        'Nov': t('months.nov'),
        'Dec': t('months.dec')
      }
      return monthMap[month] || month
    }

    const translateCategory = (category) => {
      // First try spending categories
      const spendingCategoryMap = {
        'Raw Materials': t('spendingCategories.rawMaterials'),
        'Components': t('spendingCategories.components'),
        'Equipment': t('spendingCategories.equipment'),
        'Consumables': t('spendingCategories.consumables')
      }

      // Then try product categories
      const productCategoryMap = {
        'Circuit Boards': t('categories.circuitBoards'),
        'Sensors': t('categories.sensors'),
        'Actuators': t('categories.actuators'),
        'Controllers': t('categories.controllers'),
        'Power Supplies': t('categories.powerSupplies')
      }

      return spendingCategoryMap[category] || productCategoryMap[category] || category
    }

    const handleTransactionClick = (transaction) => {
      console.log('Transaction clicked:', transaction)
      alert(`Transaction Details:\n\nID: ${transaction.id}\nDescription: ${transaction.description}\nVendor: ${transaction.vendor}\nDate: ${formatDateShort(transaction.date)}\nAmount: $${transaction.amount.toLocaleString()}`)
    }

    const showCostDetail = (monthData) => {
      selectedCostData.value = monthData
      showCostModal.value = true
    }

    onMounted(loadData)

    return {
      t,
      loading,
      error,
      summary,
      monthlySpending,
      categorySpending,
      recentTransactions,
      revenueMetrics,
      totalCosts,
      netProfit,
      profitMargin,
      monthlyRevenue,
      maxRevenueValue,
      formatCurrency,
      currencySymbol,
      getBarHeight,
      getRevenueBarHeight,
      formatDate,
      formatDateShort,
      translateMonth,
      translateCategory,
      handleTransactionClick,
      showCostModal,
      selectedCostData,
      showCostDetail,
      Math
    }
  }
}
</script>

<style scoped>
/*
 * Chart series colors, defined once so legend dots and bars always match.
 * Mapped to the status palette (blue/green/yellow/red) plus slate for revenue.
 * Operational has no palette equivalent; a violet keeps four stacked segments
 * distinguishable (justified exception to the token-only rule).
 */
.spending {
  --series-revenue: var(--color-text);
  --series-cost: var(--color-danger);
  --series-procurement: var(--color-info);
  --series-operational: #8b5cf6; /* no token: 4th distinct series color */
  --series-labor: var(--color-success);
  --series-overhead: var(--color-warning);
}

/* Sections stacked with one consistent gap; shared margins are reset so they don't double up */
.page-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.page-sections > .stats-grid,
.page-sections > .card,
.two-column-grid > .card {
  margin-bottom: 0;
}

/* ---------- KPI tiles ---------- */
/* Left accent bar ties each KPI to its chart series color */
.revenue-card { border-left: var(--space-1) solid var(--series-revenue); }
.cost-card { border-left: var(--space-1) solid var(--series-cost); }
.profit-card { border-left: var(--space-1) solid var(--series-procurement); }

.stat-change {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.stat-change.positive { color: var(--color-success-text); }
.stat-change.negative { color: var(--color-danger-text); }
.change-icon { font-weight: var(--weight-semibold); }

/* ---------- Chart legend ---------- */
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  font-size: var(--text-sm);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
}
.legend-dot {
  width: var(--space-3);
  height: var(--space-3);
  border-radius: var(--radius-sm);
}
.legend-dot.procurement { background: var(--series-procurement); }
.legend-dot.operational { background: var(--series-operational); }
.legend-dot.labor { background: var(--series-labor); }
.legend-dot.overhead { background: var(--series-overhead); }
.legend-dot.revenue-color { background: var(--series-revenue); }
.legend-dot.cost-color { background: var(--series-cost); }

/* ---------- Bar charts (shared frame) ---------- */
/* 12 month labels can't shrink below their text width, so on narrow screens
   the chart scrolls inside its card (like tables) instead of widening the page. */
.chart-container {
  padding: var(--space-2) 0 0;
  overflow-x: auto;
}

.bar-chart {
  display: flex;
  gap: var(--space-6);
  height: 350px; /* fixed plot height: bar heights are percentages of this box */
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  /* bottom padding matches the label row under the bars so "0" lines up with the baseline */
  padding: 0 var(--space-4) var(--space-8) 0;
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-subtle);
  border-right: 1px solid var(--color-border);
}

.chart-area {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: var(--space-2);
}

.bar-label {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

/* Revenue vs costs: paired bars per month */
.bar-group-revenue {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
}
.revenue-bars {
  width: 100%;
  max-width: 80px; /* chart geometry cap, not spacing: keeps bars slim on wide screens */
  display: flex;
  gap: var(--space-1);
  justify-content: center;
  align-items: flex-end;
  height: 100%;
  padding-bottom: var(--space-8);
}
.revenue-bar,
.cost-bar {
  width: 50%;
  max-width: 30px; /* chart geometry cap */
  min-height: var(--space-1);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.revenue-bar { background: var(--series-revenue); }
.cost-bar { background: var(--series-cost); }
.revenue-bar:hover,
.cost-bar:hover { opacity: 0.8; }

/* Monthly cost flow: stacked segments, first child at the bottom (column-reverse) */
.bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
}
.stacked-bar {
  width: 100%;
  max-width: 60px; /* chart geometry cap */
  display: flex;
  flex-direction: column-reverse;
  align-items: stretch;
  height: 100%;
  padding-bottom: var(--space-8);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.stacked-bar:hover { opacity: 0.85; }
.bar-segment { display: block; width: 100%; }
.bar-segment:first-child { border-radius: 0 0 var(--radius-sm) var(--radius-sm); }
.bar-segment:last-child { border-radius: var(--radius-sm) var(--radius-sm) 0 0; }
.bar-segment.procurement { background: var(--series-procurement); }
.bar-segment.operational { background: var(--series-operational); }
.bar-segment.labor { background: var(--series-labor); }
.bar-segment.overhead { background: var(--series-overhead); }

/* ---------- Category + transactions row ---------- */
/* min() lets the 450px column minimum collapse to full width on narrow screens instead of overflowing */
.two-column-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(450px, 100%), 1fr));
  gap: var(--space-6);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.category-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.category-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.category-name {
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}
.category-amount {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--color-primary);
}
.category-bar-container {
  width: 100%;
  height: var(--space-2);
  background: var(--color-surface-muted);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.category-bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}
.category-meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}
.percentage { color: var(--color-text-muted); }
.change {
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}
.change.positive { color: var(--color-success-text); }
.change.negative { color: var(--color-danger-text); }

.transactions-card {
  display: flex;
  flex-direction: column;
}
.transactions-table-container {
  max-height: 400px; /* keeps the card roughly level with the category list beside it */
  overflow-y: auto;
}
.clickable-row { cursor: pointer; }
.transaction-id {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.transaction-description {
  font-weight: var(--weight-medium);
  color: var(--color-text);
}
.transaction-vendor { color: var(--color-text-muted); }
.transaction-date {
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}
.transaction-amount {
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}
</style>
