<template>
  <div class="inventory">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('inventory.title') }}</h2>
        <p class="page-description">{{ t('inventory.description') }}</p>
      </div>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error error-action" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="btn btn-secondary btn-sm" @click="loadInventory">{{ t('common.retry') }}</button>
    </div>
    <div v-else :class="{ 'is-refreshing': refreshing }" :aria-busy="refreshing">
      <!-- Flush card: the table runs edge to edge; header padding comes from .card--flush -->
      <div class="card card--flush">
        <div class="card-header">
          <h3 class="card-title">{{ t('inventory.stockLevels') }} ({{ filteredItems.length }} {{ t('inventory.skus') }})</h3>
          <div class="card-actions">
            <div class="search-box">
              <svg class="search-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t('inventory.searchPlaceholder')"
                class="search-input"
              />
              <button
                v-if="searchQuery"
                @click="searchQuery = ''"
                type="button"
                class="clear-search"
                :title="t('inventory.clearSearch')"
                :aria-label="t('inventory.clearSearch')"
              >
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="filteredItems.length === 0"
              :title="t('inventory.exportCsvHint')"
              @click="exportCsv"
            >
              <svg class="btn-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              {{ t('inventory.exportCsv') }}
            </button>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t('inventory.table.sku') }}</th>
                <th>{{ t('inventory.table.itemName') }}</th>
                <th>{{ t('inventory.table.category') }}</th>
                <th class="num">{{ t('inventory.table.quantityOnHand') }}</th>
                <th class="num">{{ t('inventory.table.reorderPoint') }}</th>
                <th class="num">{{ t('inventory.table.unitCost') }}</th>
                <th class="num">{{ t('inventory.table.totalValue') }}</th>
                <th>{{ t('inventory.table.location') }}</th>
                <th>{{ t('inventory.table.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredItems"
                :key="item.id"
                class="clickable-row"
                @click="showItemDetail(item)"
              >
                <td><strong>{{ item.sku }}</strong></td>
                <td>{{ translateProductName(item.name) }}</td>
                <td>{{ translateCategory(item.category) }}</td>
                <td class="num"><strong>{{ item.quantity_on_hand }}</strong></td>
                <td class="num">{{ item.reorder_point }}</td>
                <td class="num">{{ currencySymbol }}{{ item.unit_cost.toFixed(2) }}</td>
                <td class="num"><strong>{{ currencySymbol }}{{ (item.quantity_on_hand * item.unit_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}</strong></td>
                <td>{{ translateWarehouse(item.location) }}</td>
                <td>
                  <span :class="['badge', getStockStatusClass(item)]">
                    {{ getStockStatus(item) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <InventoryDetailModal
      :is-open="showItemModal"
      :inventory-item="selectedItem"
      @close="showItemModal = false"
    />
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { api } from '../api'
import { useFilters } from '../composables/useFilters'
import { useI18n } from '../composables/useI18n'
import { useLatestLoad } from '../composables/useLatestLoad'
import InventoryDetailModal from '../components/InventoryDetailModal.vue'
import { toCsv, downloadCsv, buildCsvFilename } from '../utils/csv'

export default {
  name: 'Inventory',
  components: {
    InventoryDetailModal
  },
  setup() {
    const { t, currentCurrency, translateProductName, translateWarehouse } = useI18n()

    const currencySymbol = computed(() => {
      return currentCurrency.value === 'JPY' ? '¥' : '$'
    })

    const { loading, refreshing, error, run, invalidate } = useLatestLoad({
      describeError: (err) => 'Failed to load inventory: ' + err.message
    })
    const items = ref([])
    const searchQuery = ref('')

    // Modal state
    const showItemModal = ref(false)
    const selectedItem = ref(null)

    // Use shared filters
    const { selectedLocation, selectedCategory, getCurrentFilters } = useFilters()

    // Stock status order for sorting (using status keys)
    const STATUS_ORDER = { 'lowStock': 0, 'adequate': 1, 'inStock': 2 }

    // Get stock status key (for sorting and translation)
    const getStockStatusKey = (item) => {
      if (item.quantity_on_hand <= item.reorder_point) {
        return 'lowStock'
      } else if (item.quantity_on_hand <= item.reorder_point * 1.5) {
        return 'adequate'
      } else {
        return 'inStock'
      }
    }

    // Computed property to filter items by search query and sort by stock status
    const filteredItems = computed(() => {
      let filtered = items.value

      // Apply search filter if query exists
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase().trim()
        filtered = filtered.filter(item =>
          item.name.toLowerCase().includes(query)
        )
      }

      // Sort by stock status: Low Stock first, then Adequate, then In Stock
      // Always create a copy to avoid mutating the original array
      return filtered.slice().sort((a, b) => {
        const statusA = getStockStatusKey(a)
        const statusB = getStockStatusKey(b)
        return STATUS_ORDER[statusA] - STATUS_ORDER[statusB]
      })
    })

    // run() drops results of superseded requests (stale filter responses)
    const loadInventory = () => run(
      () => {
        const filters = getCurrentFilters()
        // Inventory doesn't support month/status filters, only warehouse and category
        return api.getInventory({
          warehouse: filters.warehouse,
          category: filters.category
        })
      },
      (data) => { items.value = data }
    )

    // Watch for filter changes and reload data
    watch([selectedLocation, selectedCategory], () => {
      loadInventory()
    })

    const getStockStatus = (item) => {
      const key = getStockStatusKey(item)
      return t(`status.${key}`)
    }

    const getStockStatusClass = (item) => {
      if (item.quantity_on_hand <= item.reorder_point) {
        return 'danger'
      } else if (item.quantity_on_hand <= item.reorder_point * 1.5) {
        return 'warning'
      } else {
        return 'success'
      }
    }

    const translateCategory = (category) => {
      const categoryMap = {
        'Circuit Boards': t('categories.circuitBoards'),
        'Sensors': t('categories.sensors'),
        'Actuators': t('categories.actuators'),
        'Controllers': t('categories.controllers'),
        'Power Supplies': t('categories.powerSupplies')
      }
      return categoryMap[category] || category
    }

    const showItemDetail = (item) => {
      selectedItem.value = item
      showItemModal.value = true
    }

    // Export exactly what the table shows (global filters + search, same sort).
    // Text columns use the displayed (translated) labels; numbers stay raw,
    // without currency symbols or thousands separators, so spreadsheets can
    // calculate with them.
    const exportCsv = () => {
      const columns = [
        { header: t('inventory.table.sku'), value: (item) => item.sku },
        { header: t('inventory.table.itemName'), value: (item) => translateProductName(item.name) },
        { header: t('inventory.table.category'), value: (item) => translateCategory(item.category) },
        { header: t('inventory.table.quantityOnHand'), value: (item) => item.quantity_on_hand },
        { header: t('inventory.table.reorderPoint'), value: (item) => item.reorder_point },
        { header: t('inventory.table.unitCost'), value: (item) => item.unit_cost },
        { header: t('inventory.table.totalValue'), value: (item) => Math.round(item.quantity_on_hand * item.unit_cost * 100) / 100 },
        { header: t('inventory.table.location'), value: (item) => translateWarehouse(item.location) },
        { header: t('inventory.table.status'), value: (item) => getStockStatus(item) }
      ]
      downloadCsv(buildCsvFilename('inventory'), toCsv(columns, filteredItems.value))
    }

    onMounted(loadInventory)
    onBeforeUnmount(invalidate)

    return {
      exportCsv,
      t,
      loading,
      refreshing,
      error,
      loadInventory,
      items,
      searchQuery,
      filteredItems,
      getStockStatus,
      getStockStatusClass,
      translateCategory,
      showItemModal,
      selectedItem,
      showItemDetail,
      currencySymbol,
      translateProductName,
      translateWarehouse
    }
  }
}
</script>

<style scoped>
/* Page header, card, table, badge and state styles come from styles/base.css.
   Only the search field and the clickable rows are specific to this view. */

/* Let the search field drop below the title on narrow screens */
.card-header {
  flex-wrap: wrap;
}

/* Search and export sit side by side on the right. No wrapping on wide
   screens: Chrome sizes a wrapping flex row by its widest item, which would
   push the button onto its own line even when there is room. */
.card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* On narrow screens the actions drop under the title (the header wraps)
   and the button goes under the search field */
@media (max-width: 640px) {
  .card-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .search-box {
    flex: 1 1 100%;
  }
}

.btn-icon {
  width: var(--space-4);
  height: var(--space-4);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  /* Fixed 300px next to the export button; full width on narrow screens
     (see the media query above). A flex basis is used because a percentage
     width has nothing to resolve against inside the content-sized row. */
  flex: 0 0 300px;
  min-width: 0;
}

/* Icon is absolutely positioned inside the input's left padding */
.search-icon {
  position: absolute;
  left: var(--space-3);
  width: var(--space-4);
  height: var(--space-4);
  color: var(--color-text-subtle);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: var(--control-height);
  /* Horizontal padding leaves room for the search icon (left) and clear button (right) */
  padding: 0 var(--space-10);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.search-input::placeholder {
  color: var(--color-text-subtle);
}

.clear-search {
  position: absolute;
  right: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.clear-search:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.clear-search svg {
  width: var(--space-4);
  height: var(--space-4);
}

/* Rows open the detail modal, so the hover tint uses the primary tone
   instead of the neutral base hover to signal they are clickable */
.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: var(--color-primary-soft);
}
</style>
