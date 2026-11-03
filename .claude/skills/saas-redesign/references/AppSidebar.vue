<!--
  Reference sidebar component for the SaaS redesign.
  Adapt: nav sections/items, i18n function, logo. Keep the structure and a11y.
  Props:  collapsed (bool), mobileOpen (bool)
  Emits:  toggle-collapse, close-mobile
-->
<template>
  <aside
    :class="['sidebar', { collapsed, 'mobile-open': mobileOpen }]"
    :aria-hidden="isMobile && !mobileOpen ? 'true' : null"
  >
    <div class="sidebar-brand">
      <span class="brand-mark" aria-hidden="true">{{ brandInitial }}</span>
      <span v-if="!collapsed" class="brand-name">{{ brandName }}</span>
    </div>

    <nav class="sidebar-nav" aria-label="Main">
      <div v-for="section in sections" :key="section.id" class="nav-section">
        <p v-if="!collapsed && section.label" class="nav-section-label">{{ section.label }}</p>
        <router-link
          v-for="item in section.items"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          exact-active-class="active"
          :title="collapsed ? item.label : null"
          :aria-label="collapsed ? item.label : null"
          @click="$emit('close-mobile')"
        >
          <!-- Icons are inline SVG path data so no icon package is needed -->
          <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path :d="item.icon" />
          </svg>
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

    <div class="sidebar-footer">
      <button
        type="button"
        class="collapse-btn"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-expanded="!collapsed"
        @click="$emit('toggle-collapse')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ flipped: collapsed }">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<script>
import { computed } from 'vue'

// Example icon paths (24x24, stroke-based). Replace or extend as needed.
const ICONS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  cart: 'M3 4h2l2.4 11h11.2L21 7H6.2M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  wallet: 'M3 7h18v12H3zM3 7l3-4h12l3 4M16 13h2',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  file: 'M14 3H6v18h12V7zM14 3v4h4'
}

export default {
  name: 'AppSidebar',
  props: {
    collapsed: { type: Boolean, default: false },
    mobileOpen: { type: Boolean, default: false },
    isMobile: { type: Boolean, default: false },
    brandName: { type: String, required: true },
    // [{ id, label, items: [{ to, label, icon: keyof ICONS }] }]
    navSections: { type: Array, required: true }
  },
  emits: ['toggle-collapse', 'close-mobile'],
  setup(props) {
    const brandInitial = computed(() => props.brandName.charAt(0).toUpperCase())

    // Resolve icon names to path data without mutating the prop
    const sections = computed(() =>
      props.navSections.map(section => ({
        ...section,
        items: section.items.map(item => ({ ...item, icon: ICONS[item.icon] || ICONS.file }))
      }))
    )

    return { brandInitial, sections }
  }
}
</script>

<style scoped>
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  z-index: var(--z-sidebar);
  transition: width var(--transition-base), transform var(--transition-base);
}
.sidebar.collapsed { width: var(--sidebar-width-collapsed); }

.sidebar-brand {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-5);
  border-bottom: 1px solid var(--sidebar-item-hover);
}
.brand-mark {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--sidebar-accent);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: var(--weight-semibold);
  font-size: var(--text-sm);
}
.brand-name {
  color: var(--sidebar-item-active-text);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-3);
}
.nav-section + .nav-section { margin-top: var(--space-5); }
.nav-section-label {
  margin: 0 0 var(--space-2);
  padding: 0 var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sidebar-text-muted);
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 38px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  color: var(--sidebar-text);
  text-decoration: none;
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  transition: background var(--transition-fast), color var(--transition-fast);
}
.nav-item:hover { background: var(--sidebar-item-hover); color: var(--sidebar-item-active-text); }
.nav-item:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.nav-item.active {
  background: var(--sidebar-item-active-bg);
  color: var(--sidebar-item-active-text);
}
/* Accent bar sits in the nav padding so it doesn't shift the label */
.nav-item.active::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--space-3));
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--sidebar-accent);
}
.collapsed .nav-item { justify-content: center; padding: 0; }

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.nav-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sidebar-footer {
  padding: var(--space-3);
  border-top: 1px solid var(--sidebar-item-hover);
}
.collapse-btn {
  width: 100%;
  height: 36px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--sidebar-text-muted);
  cursor: pointer;
}
.collapse-btn:hover { background: var(--sidebar-item-hover); color: var(--sidebar-text); }
.collapse-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.collapse-btn svg {
  width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;
  transition: transform var(--transition-base);
}
.collapse-btn svg.flipped { transform: rotate(180deg); }

/* Below 1024px the sidebar becomes an off-canvas drawer, always full width */
@media (max-width: 1023px) {
  .sidebar,
  .sidebar.collapsed {
    width: var(--sidebar-width);
    transform: translateX(-100%);
    z-index: var(--z-drawer);
    box-shadow: var(--shadow-lg);
  }
  .sidebar.mobile-open { transform: translateX(0); }
  .sidebar-footer { display: none; }
}
</style>
