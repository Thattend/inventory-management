<template>
  <a href="#main-content" class="skip-link">{{ t('nav.skipToContent') }}</a>

  <div :class="['app-shell', { 'sidebar-collapsed': collapsed }]">
    <AppSidebar
      :collapsed="collapsed && !isMobile"
      :mobile-open="mobileOpen"
      :is-mobile="isMobile"
      :brand-name="t('nav.companyName')"
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
          :aria-label="t('nav.openNavigation')"
          :aria-expanded="mobileOpen"
          @click="mobileOpen = true"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div class="topbar-title">{{ currentTitle }}</div>
        <div class="topbar-actions">
          <LanguageSwitcher />
          <ProfileMenu
            @show-profile-details="showProfileDetails = true"
            @show-tasks="showTasks = true"
          />
        </div>
      </header>

      <FilterBar />

      <main id="main-content" class="page" tabindex="-1">
        <router-view />
      </main>
    </div>

    <ProfileDetailsModal
      :is-open="showProfileDetails"
      @close="showProfileDetails = false"
    />

    <TasksModal
      :is-open="showTasks"
      :tasks="tasks"
      @close="showTasks = false"
      @add-task="addTask"
      @delete-task="deleteTask"
      @toggle-task="toggleTask"
    />
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from './api'
import { useAuth } from './composables/useAuth'
import { useI18n } from './composables/useI18n'
import AppSidebar from './components/AppSidebar.vue'
import FilterBar from './components/FilterBar.vue'
import ProfileMenu from './components/ProfileMenu.vue'
import ProfileDetailsModal from './components/ProfileDetailsModal.vue'
import TasksModal from './components/TasksModal.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'

export default {
  name: 'App',
  components: {
    AppSidebar,
    FilterBar,
    ProfileMenu,
    ProfileDetailsModal,
    TasksModal,
    LanguageSwitcher
  },
  setup() {
    const { currentUser } = useAuth()
    const { t } = useI18n()
    const route = useRoute()

    // --- Shell state ---
    const COLLAPSE_KEY = 'ui.sidebarCollapsed'
    const MOBILE_QUERY = '(max-width: 1023px)' // keep in sync with the @media rules below and in AppSidebar
    const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
    const mobileOpen = ref(false)
    const isMobile = ref(false)

    const toggleCollapse = () => {
      collapsed.value = !collapsed.value
      localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
    }

    // Route path -> i18n key for the top bar title
    const TITLE_KEYS = {
      '/': 'nav.overview',
      '/inventory': 'nav.inventory',
      '/orders': 'nav.orders',
      '/demand': 'nav.demandForecast',
      '/restocking': 'nav.restocking',
      '/spending': 'nav.finance',
      '/reports': 'nav.reports'
    }
    const currentTitle = computed(() => {
      const key = TITLE_KEYS[route.path]
      return key ? t(key) : t('nav.companyName')
    })

    // Close the drawer on navigation so the new page is not hidden behind it
    watch(() => route.fullPath, () => { mobileOpen.value = false })

    const mql = window.matchMedia(MOBILE_QUERY)
    const syncMobile = () => {
      isMobile.value = mql.matches
      if (!mql.matches) mobileOpen.value = false
    }
    const onKeydown = (e) => {
      if (e.key === 'Escape') mobileOpen.value = false
    }
    const showProfileDetails = ref(false)
    const showTasks = ref(false)
    const apiTasks = ref([])

    // Merge mock tasks from currentUser with API tasks
    const tasks = computed(() => {
      return [...currentUser.value.tasks, ...apiTasks.value]
    })

    const loadTasks = async () => {
      try {
        apiTasks.value = await api.getTasks()
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    }

    const addTask = async (taskData) => {
      try {
        const newTask = await api.createTask(taskData)
        // Add new task to the beginning of the array
        apiTasks.value.unshift(newTask)
      } catch (err) {
        console.error('Failed to add task:', err)
      }
    }

    const deleteTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const isMockTask = currentUser.value.tasks.some(t => t.id === taskId)

        if (isMockTask) {
          // Remove from mock tasks
          const index = currentUser.value.tasks.findIndex(t => t.id === taskId)
          if (index !== -1) {
            currentUser.value.tasks.splice(index, 1)
          }
        } else {
          // Remove from API tasks
          await api.deleteTask(taskId)
          apiTasks.value = apiTasks.value.filter(t => t.id !== taskId)
        }
      } catch (err) {
        console.error('Failed to delete task:', err)
      }
    }

    const toggleTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const mockTask = currentUser.value.tasks.find(t => t.id === taskId)

        if (mockTask) {
          // Toggle mock task status
          mockTask.status = mockTask.status === 'pending' ? 'completed' : 'pending'
        } else {
          // Toggle API task
          const updatedTask = await api.toggleTask(taskId)
          const index = apiTasks.value.findIndex(t => t.id === taskId)
          if (index !== -1) {
            apiTasks.value[index] = updatedTask
          }
        }
      } catch (err) {
        console.error('Failed to toggle task:', err)
      }
    }

    onMounted(() => {
      syncMobile()
      mql.addEventListener('change', syncMobile)
      window.addEventListener('keydown', onKeydown)
      loadTasks()
    })
    onBeforeUnmount(() => {
      mql.removeEventListener('change', syncMobile)
      window.removeEventListener('keydown', onKeydown)
    })

    return {
      t,
      collapsed,
      mobileOpen,
      isMobile,
      currentTitle,
      toggleCollapse,
      showProfileDetails,
      showTasks,
      tasks,
      addTask,
      deleteTask,
      toggleTask
    }
  }
}
</script>

<style>
/* ---- App shell (global base/patterns live in styles/base.css) ---- */
.app-shell { min-height: 100vh; }

/* Content is offset by the fixed sidebar; the offset follows the collapse state */
.app-main {
  margin-left: var(--sidebar-width);
  transition: margin-left var(--transition-base);
  min-width: 0; /* lets wide tables scroll instead of stretching the layout */
}
.sidebar-collapsed .app-main { margin-left: var(--sidebar-width-collapsed); }

/* Sticky stack: topbar (top: 0, z-topbar) then FilterBar (top: topbar height, z-subbar) */
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
.topbar-title {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.topbar-actions { margin-left: auto; display: flex; align-items: center; gap: var(--space-3); }

.icon-btn {
  width: var(--control-height);
  height: var(--control-height);
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.icon-btn:hover { background: var(--color-surface-muted); }
.icon-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.icon-btn svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }

.page {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-6) var(--space-8);
}
.page:focus { outline: none; } /* programmatic focus target of the skip link */

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  z-index: var(--z-backdrop);
}

.skip-link {
  position: fixed;
  left: var(--space-4);
  top: calc(-1 * var(--space-12) * 2);
  z-index: calc(var(--z-drawer) + 2000); /* above everything, incl. modals (z-index 2000 in components) */
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
.skip-link:focus { top: var(--space-4); }

/* Below 1024px the sidebar is an off-canvas drawer (see AppSidebar), content uses full width */
@media (max-width: 1023px) {
  .app-main,
  .sidebar-collapsed .app-main { margin-left: 0; }
  .topbar { padding: 0 var(--space-4); }
  .page { padding: var(--space-4); }
  .profile-name { display: none; } /* keep top bar compact: avatar only */
}
</style>
