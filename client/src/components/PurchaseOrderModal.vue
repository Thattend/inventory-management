<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && backlogItem" class="modal-overlay" @click="close">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">
              {{ mode === 'view' ? t('purchaseOrder.viewTitle') : t('purchaseOrder.createTitle') }}
            </h3>
            <button class="close-button" @click="close" :aria-label="t('common.close')">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="item-summary">
              <div class="item-name">{{ translateProductName(backlogItem.item_name) }}</div>
              <div class="item-meta">
                {{ t('purchaseOrder.sku') }}: <span class="mono">{{ backlogItem.item_sku }}</span>
                <span class="sep">|</span>
                {{ t('purchaseOrder.shortage') }}: {{ shortage }} {{ t('purchaseOrder.units') }}
              </div>
            </div>

            <!-- View mode -->
            <template v-if="mode === 'view'">
              <div v-if="loadingPO" class="loading">{{ t('common.loading') }}</div>
              <div v-else-if="loadError" class="error">{{ loadError }}</div>
              <div v-else-if="po" class="info-grid">
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.poId') }}</div>
                  <div class="info-value mono">{{ po.id }}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.status') }}</div>
                  <div class="info-value">{{ po.status }}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.supplierName') }}</div>
                  <div class="info-value">{{ po.supplier_name }}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.expectedDelivery') }}</div>
                  <div class="info-value">{{ po.expected_delivery_date }}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.quantity') }}</div>
                  <div class="info-value">{{ po.quantity }}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.unitCost') }}</div>
                  <div class="info-value">{{ formatMoney(po.unit_cost) }}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.total') }}</div>
                  <div class="info-value">{{ formatMoney(po.quantity * po.unit_cost) }}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.createdDate') }}</div>
                  <div class="info-value">{{ po.created_date }}</div>
                </div>
                <div v-if="po.notes" class="info-item full">
                  <div class="info-label">{{ t('purchaseOrder.notes') }}</div>
                  <div class="info-value notes">{{ po.notes }}</div>
                </div>
              </div>
            </template>

            <!-- Create mode -->
            <form v-else id="po-form" class="po-form" @submit.prevent="submit" novalidate>
              <div v-if="submitError" class="error">{{ submitError }}</div>

              <div class="field">
                <label for="po-supplier">{{ t('purchaseOrder.supplierName') }}</label>
                <input id="po-supplier" v-model="form.supplierName" type="text" maxlength="200" />
                <div v-if="errors.supplierName" class="field-error">{{ errors.supplierName }}</div>
              </div>

              <div class="field-row">
                <div class="field">
                  <label for="po-quantity">{{ t('purchaseOrder.quantity') }}</label>
                  <input id="po-quantity" v-model="form.quantity" type="number" min="1" step="1" />
                  <div v-if="errors.quantity" class="field-error">{{ errors.quantity }}</div>
                </div>
                <div class="field">
                  <label for="po-cost">{{ t('purchaseOrder.unitCost') }}</label>
                  <input id="po-cost" v-model="form.unitCost" type="number" min="0" step="0.01" />
                  <div v-if="errors.unitCost" class="field-error">{{ errors.unitCost }}</div>
                </div>
              </div>

              <div class="field">
                <label for="po-date">{{ t('purchaseOrder.expectedDelivery') }}</label>
                <input id="po-date" v-model="form.expectedDate" type="date" />
                <div v-if="errors.expectedDate" class="field-error">{{ errors.expectedDate }}</div>
              </div>

              <div class="field">
                <label for="po-notes">{{ t('purchaseOrder.notes') }}</label>
                <textarea id="po-notes" v-model="form.notes" rows="3"></textarea>
                <div v-if="errors.notes" class="field-error">{{ errors.notes }}</div>
              </div>

              <div class="total-row">
                <span>{{ t('purchaseOrder.total') }}</span>
                <strong>{{ formatMoney(total) }}</strong>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="close">{{ t('common.close') }}</button>
            <button
              v-if="mode !== 'view'"
              type="submit"
              form="po-form"
              class="btn btn-primary"
              :disabled="!isValid || submitting"
            >
              {{ submitting ? t('purchaseOrder.submitting') : t('purchaseOrder.submit') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { ref, reactive, computed, watch } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'

const NOTES_MAX = 1000

const emptyForm = (item) => ({
  supplierName: '',
  quantity: item ? String(Math.max(item.quantity_needed - item.quantity_available, 1)) : '',
  unitCost: '',
  expectedDate: '',
  notes: ''
})

export default {
  name: 'PurchaseOrderModal',
  props: {
    isOpen: { type: Boolean, default: false },
    backlogItem: { type: Object, default: null },
    mode: { type: String, default: 'create', validator: (v) => ['create', 'view'].includes(v) }
  },
  emits: ['close', 'po-created'],
  setup(props, { emit }) {
    const { t, translateProductName } = useI18n()

    const form = reactive(emptyForm(null))
    const submitting = ref(false)
    const submitError = ref(null)
    const po = ref(null)
    const loadingPO = ref(false)
    const loadError = ref(null)

    const shortage = computed(() =>
      props.backlogItem ? props.backlogItem.quantity_needed - props.backlogItem.quantity_available : 0
    )

    const qtyNum = computed(() => Number(form.quantity))
    const costNum = computed(() => Number(form.unitCost))
    const total = computed(() => {
      const value = qtyNum.value * costNum.value
      return Number.isFinite(value) ? value : 0
    })

    // Mirrors backend rules: quantity int > 0, unit_cost > 0, date required, notes <= 1000
    const errors = computed(() => ({
      supplierName: form.supplierName.trim() ? '' : t('purchaseOrder.errSupplierRequired'),
      quantity: Number.isInteger(qtyNum.value) && qtyNum.value > 0 && form.quantity !== ''
        ? '' : t('purchaseOrder.errQuantity'),
      unitCost: Number.isFinite(costNum.value) && costNum.value > 0 && form.unitCost !== ''
        ? '' : t('purchaseOrder.errUnitCost'),
      expectedDate: /^\d{4}-\d{2}-\d{2}$/.test(form.expectedDate) && !isNaN(new Date(form.expectedDate).getTime())
        ? '' : t('purchaseOrder.errDateRequired'),
      notes: form.notes.length <= NOTES_MAX ? '' : t('purchaseOrder.errNotesLength')
    }))
    const isValid = computed(() => Object.values(errors.value).every((e) => !e))

    const formatMoney = (amount) =>
      `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const loadPO = async (item) => {
      loadingPO.value = true
      loadError.value = null
      po.value = null
      try {
        po.value = await api.getPurchaseOrderByBacklogItem(item.id)
      } catch (err) {
        console.error('Failed to load purchase order', err)
        loadError.value = t('purchaseOrder.errLoad')
      } finally {
        loadingPO.value = false
      }
    }

    // Reset/load whenever the modal opens or the target item/mode changes
    watch(
      () => [props.isOpen, props.backlogItem?.id, props.mode],
      ([open]) => {
        if (!open || !props.backlogItem) return
        submitError.value = null
        if (props.mode === 'view') {
          loadPO(props.backlogItem)
        } else {
          Object.assign(form, emptyForm(props.backlogItem))
        }
      },
      { immediate: true }
    )

    const apiErrorMessage = (err) => {
      const status = err?.response?.status
      if (status === 409) return t('purchaseOrder.errExists')
      if (status === 404) return t('purchaseOrder.errNotFound')
      if (status === 422) return t('purchaseOrder.errValidation')
      return t('purchaseOrder.errGeneric')
    }

    const submit = async () => {
      if (!isValid.value || submitting.value) return
      submitting.value = true
      submitError.value = null
      try {
        const created = await api.createPurchaseOrder({
          backlog_item_id: props.backlogItem.id,
          supplier_name: form.supplierName.trim(),
          quantity: qtyNum.value,
          unit_cost: costNum.value,
          expected_delivery_date: form.expectedDate,
          notes: form.notes.trim() || null
        })
        emit('po-created', created)
      } catch (err) {
        console.error('Failed to create purchase order', err)
        submitError.value = apiErrorMessage(err)
      } finally {
        submitting.value = false
      }
    }

    const close = () => emit('close')

    return {
      t, translateProductName, form, errors, isValid, total, shortage, submitting, submitError,
      po, loadingPO, loadError, formatMoney, submit, close
    }
  }
}
</script>

<style scoped>
/* ---- Modal shell: identical block in every modal component ----
   Modals are teleported to <body>, so --z-modal (100) only has to beat the app shell
   layers (top bar 20, sidebar 30, mobile drawer 50) defined in tokens.css. */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-overlay);
  z-index: var(--z-modal);
}

/* Header and footer stay fixed; only .modal-body scrolls inside the 90vh cap */
.modal-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  /* Per-modal width; tokens define no component widths, so this stays literal */
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  color: var(--color-text);
}

/* Square icon button, same height as .btn so the header row stays aligned */
.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.close-button:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.close-button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border);
}

/* Modal transition: fade the overlay, scale the panel slightly */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-base);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform var(--transition-base);
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}

.item-summary {
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.item-name {
  margin-bottom: var(--space-1);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.item-meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.sep {
  margin: 0 var(--space-2);
  color: var(--color-text-subtle);
}

.mono {
  font-family: var(--font-mono);
}

.po-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* The form already spaces children with gap; drop the shared .error margin to avoid doubling */
.po-form > .error {
  margin: 0;
}

.field-row {
  display: flex;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
}

.field label {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.field input,
.field textarea {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font: inherit;
  font-size: var(--text-base);
  color: var(--color-text);
  resize: vertical;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

/* Single-line inputs share the button height so the form lines up with .btn */
.field input {
  height: var(--control-height);
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.field-error {
  font-size: var(--text-sm);
  color: var(--color-danger);
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-5);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-item.full {
  grid-column: 1 / -1;
}

.info-label {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.info-value {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

.info-value.notes {
  white-space: pre-wrap;
  font-weight: var(--weight-regular);
}
</style>
