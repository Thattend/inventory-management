<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && backlogItem" class="modal-overlay" @click="close">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">Inventory Shortage Details</h3>
            <button class="close-button" @click="close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="detail-hero">
              <div class="hero-icon danger-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 8L24 28M24 34L24 36" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                  <circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/>
                </svg>
              </div>
              <div class="hero-title">
                <h4 class="hero-name">{{ translateProductName(backlogItem.item_name) }}</h4>
                <div class="hero-sku">SKU: {{ backlogItem.item_sku }}</div>
              </div>
              <span class="badge hero-badge" :class="backlogItem.priority">
                {{ backlogItem.priority }} Priority
              </span>
            </div>

            <div class="summary-grid">
              <div class="summary-card danger">
                <div class="summary-label">Shortage Amount</div>
                <div class="summary-value">{{ shortage }} units</div>
              </div>
              <div class="summary-card warning">
                <div class="summary-label">Days Delayed</div>
                <div class="summary-value">{{ backlogItem.days_delayed }} days</div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Order ID</div>
                <div class="info-value mono link-value">{{ backlogItem.order_id }}</div>
              </div>

              <div class="info-item">
                <div class="info-label">Item SKU</div>
                <div class="info-value mono link-value">{{ backlogItem.item_sku }}</div>
              </div>

              <div class="info-item">
                <div class="info-label">Quantity Needed</div>
                <div class="info-value">{{ backlogItem.quantity_needed }} units</div>
              </div>

              <div class="info-item">
                <div class="info-label">Quantity Available</div>
                <div class="info-value">{{ backlogItem.quantity_available }} units</div>
              </div>

              <div class="info-item">
                <div class="info-label">Expected Date</div>
                <div class="info-value">{{ formatDate(backlogItem.expected_date) }}</div>
              </div>

              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">
                  <span class="badge danger">Backordered</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="close">Close</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n'

const { translateProductName } = useI18n()

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  backlogItem: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const shortage = computed(() => {
  if (!props.backlogItem) return 0
  return props.backlogItem.quantity_needed - props.backlogItem.quantity_available
})

const close = () => {
  emit('close')
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
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
  max-width: 700px;
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

/* ---- Detail layout shared by the read-only detail modals ---- */
/* Hero row: icon tile, name + SKU (truncates), status badge pinned right */
.detail-hero {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding-bottom: var(--space-6);
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

/* 64px tile = --space-12 + --space-4; soft background + semantic text color */
.hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: calc(var(--space-12) + var(--space-4));
  height: calc(var(--space-12) + var(--space-4));
  border-radius: var(--radius-lg);
  background: var(--color-info-soft);
  color: var(--color-info);
}

.hero-icon.success-icon { background: var(--color-success-soft); color: var(--color-success); }
.hero-icon.warning-icon { background: var(--color-warning-soft); color: var(--color-warning); }
.hero-icon.danger-icon { background: var(--color-danger-soft); color: var(--color-danger); }

.hero-title {
  flex: 1;
  min-width: 0;
}

.hero-name {
  margin-bottom: var(--space-1);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  color: var(--color-text);
}

.hero-sku {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* Header badge reuses the shared .badge colors; only keep it from shrinking */
.hero-badge {
  flex-shrink: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

/* Small stat tiles inside a modal: tinted variant of .stat-card */
.summary-card {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg);
}

.summary-card.primary { background: var(--color-info-soft); }
.summary-card.success-card { background: var(--color-success-soft); }
.summary-card.warning-card { background: var(--color-warning-soft); }
.summary-card.danger-card,
.summary-card.danger { background: var(--color-danger-soft); border-color: var(--color-danger-border); }
.summary-card.warning { background: var(--color-warning-soft); }

.summary-label {
  margin-bottom: var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.summary-value {
  font-size: var(--text-2xl);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}

.summary-subtitle {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* auto-fit collapses to one column on narrow modals without a media query */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-5) var(--space-6);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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

.mono {
  font-family: var(--font-mono);
}

/* Values that sit inside the summary tiles take the tile's semantic color */
.summary-card.danger .summary-value { color: var(--color-danger); }
.summary-card.warning .summary-value { color: var(--color-warning-text); }

/* Identifiers (order ID, SKU) highlighted in the primary color */
.link-value { color: var(--color-primary); }
</style>
