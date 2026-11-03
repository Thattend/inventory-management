# App shell reference

How `App.vue` wires the sidebar, top bar, and content area. Adapt names to the project.

## Template

```vue
<template>
  <a href="#main-content" class="skip-link">Skip to content</a>

  <div :class="['app-shell', { 'sidebar-collapsed': collapsed }]">
    <AppSidebar
      :collapsed="collapsed && !isMobile"
      :mobile-open="mobileOpen"
      :is-mobile="isMobile"
      :brand-name="t('nav.companyName')"
      :nav-sections="navSections"
      @toggle-collapse="toggleCollapse"
      @close-mobile="mobileOpen = false"
    />

    <!-- Backdrop only exists while the mobile drawer is open -->
    <div v-if="isMobile && mobileOpen" class="drawer-backdrop" @click="mobileOpen = false" />

    <div class="app-main">
      <header class="topbar">
        <button
          v-if="isMobile"
          type="button"
          class="icon-btn"
          aria-label="Open navigation"
          :aria-expanded="mobileOpen"
          @click="mobileOpen = true"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div class="topbar-title">{{ currentTitle }}</div>
        <div class="topbar-actions">
          <!-- Move existing utilities here: LanguageSwitcher, ProfileMenu, etc. -->
        </div>
      </header>

      <!-- Optional: global filters as a sticky sub-bar -->
      <!-- <div class="filter-subbar"><FilterBar /></div> -->

      <main id="main-content" class="page" tabindex="-1">
        <router-view />
      </main>
    </div>
  </div>
</template>
```

## Script essentials

```js
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

const COLLAPSE_KEY = 'ui.sidebarCollapsed'
const MOBILE_QUERY = '(max-width: 1023px)'

// inside setup():
const route = useRoute()
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
const mobileOpen = ref(false)
const isMobile = ref(false)

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
}

// Single source for nav: labels via i18n so they follow the language switch
const navSections = computed(() => [
  { id: 'main', label: null, items: [
    { to: '/', label: t('nav.overview'), icon: 'home' }
  ]},
  { id: 'ops', label: 'Operations', items: [
    { to: '/inventory', label: t('nav.inventory'), icon: 'box' },
    { to: '/orders', label: t('nav.orders'), icon: 'cart' }
  ]}
])

// Close the drawer on navigation so the new page isn't hidden behind it
watch(() => route.fullPath, () => { mobileOpen.value = false })

const mql = window.matchMedia(MOBILE_QUERY)
const syncMobile = () => { isMobile.value = mql.matches; if (!mql.matches) mobileOpen.value = false }
const onKey = (e) => { if (e.key === 'Escape') mobileOpen.value = false }

onMounted(() => {
  syncMobile()
  mql.addEventListener('change', syncMobile)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  mql.removeEventListener('change', syncMobile)
  window.removeEventListener('keydown', onKey)
})
```

## Layout CSS

```css
.app-shell { min-height: 100vh; background: var(--color-bg); }

/* Content is offset by the fixed sidebar; the offset follows the collapse state */
.app-main {
  margin-left: var(--sidebar-width);
  transition: margin-left var(--transition-base);
  min-width: 0; /* lets wide tables scroll instead of stretching the layout */
}
.sidebar-collapsed .app-main { margin-left: var(--sidebar-width-collapsed); }

.topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-topbar);
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-8);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.topbar-title { font-size: var(--text-md); font-weight: var(--weight-semibold); }
.topbar-actions { margin-left: auto; display: flex; align-items: center; gap: var(--space-3); }

.page {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8);
}
.page:focus { outline: none; }

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: var(--z-backdrop);
}

.skip-link {
  position: absolute;
  left: var(--space-4);
  top: -100px;
  z-index: var(--z-modal);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
.skip-link:focus { top: var(--space-4); }

@media (max-width: 1023px) {
  .app-main,
  .sidebar-collapsed .app-main { margin-left: 0; }
  .topbar { padding: 0 var(--space-4); }
  .page { padding: var(--space-4); }
}
```

## Shared page patterns

```html
<div class="page-header">
  <div>
    <h1 class="page-title">Orders</h1>
    <p class="page-description">View and manage customer orders</p>
  </div>
  <div class="page-actions"><!-- buttons --></div>
</div>
```

```css
.page-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: var(--space-4); margin-bottom: var(--space-6);
}
.page-title { margin: 0; font-size: var(--text-2xl); font-weight: var(--weight-semibold); line-height: var(--leading-tight); }
.page-description { margin: var(--space-1) 0 0; color: var(--color-text-muted); }

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.card + .card { margin-top: var(--space-6); }
.card-header { padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--color-border); }
.card-body { padding: var(--space-6); }

.stats-grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: var(--space-6); }

.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: var(--text-base); }
th {
  position: sticky; top: 0; z-index: var(--z-sticky);
  background: var(--color-surface-muted); color: var(--color-text-muted);
  font-size: var(--text-xs); font-weight: var(--weight-semibold);
  text-transform: uppercase; letter-spacing: 0.04em; text-align: left;
  padding: var(--space-3) var(--space-4);
}
td { padding: var(--space-3) var(--space-4); border-top: 1px solid var(--color-border); }
tbody tr:hover { background: var(--color-surface-muted); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
```
