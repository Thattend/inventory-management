<template>
  <div class="orders">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('orders.title') }}</h2>
        <p class="page-description">{{ t('orders.description') }}</p>
      </div>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error error-action" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="btn btn-secondary btn-sm" @click="loadOrders">{{ t('common.retry') }}</button>
    </div>
    <div v-else class="page-sections" :class="{ 'is-refreshing': refreshing }" :aria-busy="refreshing">
      <div class="stats-grid">
        <div class="stat-card success">
          <div class="stat-label">{{ t('status.delivered') }}</div>
          <div class="stat-value">{{ getOrdersByStatus('Delivered').length }}</div>
        </div>
        <div class="stat-card info">
          <div class="stat-label">{{ t('status.shipped') }}</div>
          <div class="stat-value">{{ getOrdersByStatus('Shipped').length }}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">{{ t('status.processing') }}</div>
          <div class="stat-value">{{ getOrdersByStatus('Processing').length }}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">{{ t('status.backordered') }}</div>
          <div class="stat-value">{{ getOrdersByStatus('Backordered').length }}</div>
        </div>
      </div>

      <!-- Flush cards: tables run edge to edge; header padding comes from .card--flush -->
      <div v-if="restockOrders.length > 0" class="card card--flush">
        <div class="card-header">
          <h3 class="card-title">{{ t('orders.submittedOrders.title') }} ({{ restockOrders.length }})</h3>
        </div>
        <div class="table-container">
          <table class="orders-table">
            <thead>
              <tr>
                <th class="col-order-number">{{ t('orders.table.orderNumber') }}</th>
                <th class="col-items">{{ t('orders.submittedOrders.items') }}</th>
                <th class="col-value num">{{ t('orders.submittedOrders.total') }}</th>
                <th class="col-date">{{ t('orders.submittedOrders.submittedDate') }}</th>
                <th class="col-date num">{{ t('orders.submittedOrders.leadTime') }}</th>
                <th class="col-date">{{ t('orders.submittedOrders.expectedDelivery') }}</th>
                <th class="col-status">{{ t('orders.submittedOrders.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in restockOrders" :key="order.id">
                <td class="col-order-number"><strong>{{ order.order_number }}</strong></td>
                <td class="col-items">
                  <details class="items-details">
                    <summary class="items-summary">
                      {{ t('orders.itemsCount', { count: order.lines.length }) }}
                    </summary>
                    <div class="items-dropdown">
                      <div v-for="line in order.lines" :key="line.sku" class="item-entry">
                        <span class="item-name">{{ translateProductName(line.name) }}</span>
                        <span class="item-meta">{{ t('orders.quantity') }}: {{ line.quantity }} @ {{ formatCurrencyWithDecimals(line.unit_cost, currentCurrency, 2) }}</span>
                      </div>
                    </div>
                  </details>
                </td>
                <td class="col-value num"><strong>{{ formatCurrencyWithDecimals(order.total_cost, currentCurrency, 2) }}</strong></td>
                <td class="col-date">{{ formatDate(order.submitted_date) }}</td>
                <td class="col-date num">{{ t('orders.submittedOrders.leadTimeDays', { days: order.lead_time_days }) }}</td>
                <td class="col-date">{{ formatDate(order.expected_delivery) }}</td>
                <td class="col-status">
                  <span class="badge info">{{ t('orders.submittedOrders.statusSubmitted') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card card--flush">
        <div class="card-header">
          <h3 class="card-title">{{ t('orders.allOrders') }} ({{ orders.length }})</h3>
        </div>
        <div class="table-container table-container--scroll">
          <table class="orders-table">
            <thead>
              <tr>
                <th class="col-order-number">{{ t('orders.table.orderNumber') }}</th>
                <th class="col-customer">{{ t('orders.table.customer') }}</th>
                <th class="col-items">{{ t('orders.table.items') }}</th>
                <th class="col-status">{{ t('orders.table.status') }}</th>
                <th class="col-date">{{ t('orders.table.orderDate') }}</th>
                <th class="col-date">{{ t('orders.table.expectedDelivery') }}</th>
                <th class="col-value num">{{ t('orders.table.totalValue') }}</th>
              </tr>
            </thead>
            <tbody>
              <!-- order ids are not unique in the data; a duplicate key makes Vue duplicate rows on refresh -->
              <tr v-for="order in orders" :key="`${order.id}|${order.customer}|${order.order_date}`">
                <td class="col-order-number"><strong>{{ order.order_number }}</strong></td>
                <td class="col-customer">{{ translateCustomerName(order.customer) }}</td>
                <td class="col-items">
                  <details class="items-details">
                    <summary class="items-summary">
                      {{ t('orders.itemsCount', { count: order.items.length }) }}
                    </summary>
                    <div class="items-dropdown">
                      <div v-for="(item, idx) in order.items" :key="idx" class="item-entry">
                        <span class="item-name">{{ translateProductName(item.name) }}</span>
                        <span class="item-meta">{{ t('orders.quantity') }}: {{ item.quantity }} @ {{ currencySymbol }}{{ item.unit_price }}</span>
                      </div>
                    </div>
                  </details>
                </td>
                <td class="col-status">
                  <span :class="['badge', getOrderStatusClass(order.status)]">
                    {{ t(`status.${order.status.toLowerCase()}`) }}
                  </span>
                </td>
                <td class="col-date">{{ formatDate(order.order_date) }}</td>
                <td class="col-date">{{ formatDate(order.expected_delivery) }}</td>
                <td class="col-value num"><strong>{{ currencySymbol }}{{ order.total_value.toLocaleString() }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { api } from '../api'
import { useFilters } from '../composables/useFilters'
import { useI18n } from '../composables/useI18n'
import { useLatestLoad } from '../composables/useLatestLoad'
import { formatCurrencyWithDecimals } from '../utils/currency'

export default {
  name: 'Orders',
  setup() {
    const { t, currentCurrency, translateProductName, translateCustomerName } = useI18n()

    const currencySymbol = computed(() => {
      return currentCurrency.value === 'JPY' ? '¥' : '$'
    })
    const { loading, refreshing, error, run, invalidate } = useLatestLoad({
      describeError: (err) => 'Failed to load orders: ' + err.message
    })
    const orders = ref([])
    const restockOrders = ref([])

    // Use shared filters
    const {
      selectedPeriod,
      selectedLocation,
      selectedCategory,
      selectedStatus,
      getCurrentFilters
    } = useFilters()

    // run() drops results of superseded requests (stale filter responses)
    const loadOrders = () => run(
      () => api.getOrders(getCurrentFilters()),
      (fetchedOrders) => {
        // Sort orders by order_date (earliest first) on a copy, not the API result
        orders.value = [...fetchedOrders].sort((a, b) => {
          const dateA = new Date(a.order_date)
          const dateB = new Date(b.order_date)
          return dateA - dateB
        })
      }
    )

    // Watch for filter changes and reload data
    watch([selectedPeriod, selectedLocation, selectedCategory, selectedStatus], () => {
      loadOrders()
    })

    const getOrdersByStatus = (status) => {
      return orders.value.filter(order => order.status === status)
    }

    const getOrderStatusClass = (status) => {
      const statusMap = {
        'Delivered': 'success',
        'Shipped': 'info',
        'Processing': 'warning',
        'Backordered': 'danger'
      }
      return statusMap[status] || 'info'
    }

    const formatDate = (dateString) => {
      // Guard against missing/invalid dates instead of rendering "Invalid Date"
      if (!dateString || isNaN(new Date(dateString).getTime())) return '-'
      const { currentLocale } = useI18n()
      const locale = currentLocale.value === 'ja' ? 'ja-JP' : 'en-US'
      return new Date(dateString).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }

    // Independent of the filter-driven loadOrders: a failure here only hides the card
    const loadRestockOrders = async () => {
      try {
        const result = await api.getRestockOrders()
        restockOrders.value = Array.isArray(result) ? result : []
      } catch (err) {
        console.error('Failed to load submitted orders:', err)
        restockOrders.value = []
      }
    }

    onBeforeUnmount(invalidate)

    onMounted(() => {
      loadOrders()
      loadRestockOrders()
    })

    return {
      t,
      loading,
      refreshing,
      error,
      loadOrders,
      orders,
      restockOrders,
      currentCurrency,
      formatCurrencyWithDecimals,
      getOrdersByStatus,
      getOrderStatusClass,
      formatDate,
      currencySymbol,
      translateProductName,
      translateCustomerName
    }
  }
}
</script>

<style scoped>
/* Page header, cards, stat tiles, tables, badges and states come from styles/base.css. */

/* Vertical rhythm: one gap between sections instead of per-element margins */
.page-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.page-sections > * {
  margin: 0;
}

/* 250+ rows: cap the table height so it scrolls inside the card. The container is then
   the scroll box, which is what lets the sticky <th> from base.css stay visible. */
.table-container--scroll {
  max-height: 70vh;
  overflow: auto;
}

/* Fixed table layout to prevent column shifting */
.orders-table {
  table-layout: fixed;
  width: 100%;
}

/* Column widths (layout dimensions, intentionally not spacing tokens) */
.col-order-number {
  width: 130px;
}

.col-customer {
  width: 180px;
}

.col-items {
  width: 200px;
}

.col-status {
  width: 130px;
}

.col-date {
  width: 140px;
}

.col-value {
  width: 120px;
}

/* Items details styling */
.items-details {
  position: relative;
}

.items-summary {
  cursor: pointer;
  color: var(--color-primary);
  font-weight: var(--weight-medium);
  list-style: none;
  user-select: none;
  display: inline-block;
}

.items-summary::-webkit-details-marker {
  display: none;
}

/* Disclosure arrow (a text glyph, not an emoji) rotates when the details element opens */
.items-summary::before {
  content: '\25B6';
  display: inline-block;
  margin-right: var(--space-2);
  font-size: var(--text-xs);
  transition: transform var(--transition-base);
}

.items-details[open] .items-summary::before {
  transform: rotate(90deg);
}

.items-summary:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

/* Dropdown container. One layer above the sticky table header (same stacking context)
   so an open list near the top is not hidden behind it; still below the filter sub-bar. */
.items-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-3);
  z-index: calc(var(--z-sticky) + 1);
  min-width: 300px;
  max-width: 400px;
}

.item-entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-surface-muted);
}

.item-entry:last-child {
  border-bottom: none;
}

.item-name {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

.item-meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
