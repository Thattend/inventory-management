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
              <div v-if="loadingPO" class="state-text">{{ t('common.loading') }}</div>
              <div v-else-if="loadError" class="error-banner">{{ loadError }}</div>
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
              <div v-if="submitError" class="error-banner">{{ submitError }}</div>

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
            <button type="button" class="btn-secondary" @click="close">{{ t('common.close') }}</button>
            <button
              v-if="mode !== 'view'"
              type="submit"
              form="po-form"
              class="btn-primary"
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
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.close-button {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.item-summary {
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid #e2e8f0;
}

.item-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.item-meta {
  font-size: 0.875rem;
  color: #64748b;
}

.sep {
  margin: 0 0.5rem;
}

.mono {
  font-family: 'Monaco', 'Courier New', monospace;
}

.po-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
}

.field-row {
  display: flex;
  gap: 1rem;
}

.field label {
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.field input,
.field textarea {
  padding: 0.625rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.938rem;
  font-family: inherit;
  color: #0f172a;
  resize: vertical;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: #64748b;
}

.field-error {
  font-size: 0.813rem;
  color: #dc2626;
}

.error-banner {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
  font-size: 0.875rem;
}

.state-text {
  color: #64748b;
  padding: 1rem 0;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #0f172a;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.info-item.full {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.info-value {
  font-size: 0.938rem;
  color: #0f172a;
  font-weight: 500;
}

.info-value.notes {
  white-space: pre-wrap;
  font-weight: 400;
}

.modal-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-secondary,
.btn-primary {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.btn-secondary {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #334155;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: #0f172a;
  border: 1px solid #0f172a;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1e293b;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>
