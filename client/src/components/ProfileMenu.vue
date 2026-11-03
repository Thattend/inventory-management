<template>
  <div class="profile-menu">
    <button
      class="profile-button"
      @click="toggleDropdown"
      @blur="handleBlur"
    >
      <div class="avatar">
        {{ getInitials(currentUser.name) }}
      </div>
      <span class="profile-name">{{ currentUser.name }}</span>
      <svg
        class="chevron"
        :class="{ 'chevron-open': isDropdownOpen }"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <div v-if="isDropdownOpen" class="dropdown-menu">
      <div class="dropdown-header">
        <div class="avatar-large">
          {{ getInitials(currentUser.name) }}
        </div>
        <div class="user-info">
          <div class="user-name">{{ currentUser.name }}</div>
          <div class="user-email">{{ currentUser.email }}</div>
        </div>
      </div>

      <div class="dropdown-divider"></div>

      <button
        class="dropdown-item"
        @mousedown.prevent="showProfileDetails"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 9C10.6569 9 12 7.65685 12 6C12 4.34315 10.6569 3 9 3C7.34315 3 6 4.34315 6 6C6 7.65685 7.34315 9 9 9Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M15 15C15 12.7909 12.3137 11 9 11C5.68629 11 3 12.7909 3 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        {{ t('profile.profileDetails') }}
      </button>

      <button
        class="dropdown-item"
        @mousedown.prevent="showTasks"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M15 3H3C2.44772 3 2 3.44772 2 4V14C2 14.5523 2.44772 15 3 15H15C15.5523 15 16 14.5523 16 14V4C16 3.44772 15.5523 3 15 3Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M6 7L8 9L12 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {{ t('profile.myTasks') }}
        <span v-if="pendingTaskCount > 0" class="task-badge">{{ pendingTaskCount }}</span>
      </button>

      <div class="dropdown-divider"></div>

      <button
        class="dropdown-item logout"
        @mousedown.prevent="handleLogout"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M7 15H4C3.44772 15 3 14.5523 3 14V4C3 3.44772 3.44772 3 4 3H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M11 12L15 9M15 9L11 6M15 9H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {{ t('profile.logout') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../composables/useI18n'

const { currentUser, logout, getInitials } = useAuth()
const { t } = useI18n()

const isDropdownOpen = ref(false)
const emit = defineEmits(['show-profile-details', 'show-tasks'])

const pendingTaskCount = computed(() => {
  return currentUser.value.tasks.filter(task => task.status === 'pending').length
})

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

const handleBlur = () => {
  // Delay to allow mousedown events on dropdown items to fire first
  setTimeout(() => {
    isDropdownOpen.value = false
  }, 200)
}

const showProfileDetails = () => {
  isDropdownOpen.value = false
  emit('show-profile-details')
}

const showTasks = () => {
  isDropdownOpen.value = false
  emit('show-tasks')
}

const handleLogout = () => {
  isDropdownOpen.value = false
  logout()
}
</script>

<style scoped>
.profile-menu {
  position: relative;
}

/* Top-bar trigger button: same height as .btn so it lines up with other top-bar controls */
.profile-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-height);
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.profile-button:hover {
  background: var(--color-surface-muted);
  border-color: var(--color-border-strong);
}

.profile-button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform var(--transition-base);
}

.chevron-open {
  transform: rotate(180deg);
}

/* Dropdown panel. z-index 1000 is kept on purpose: it is local to the top bar's
   stacking context (--z-topbar), so it only needs to beat siblings inside the top bar;
   the top bar itself sits above the filter sub-bar, so the panel overlays it. */
.dropdown-menu {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  min-width: 280px;
  padding: var(--space-1) 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  text-align: left;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--color-surface-muted);
}

.dropdown-item:focus-visible {
  outline: none;
  background: var(--color-surface-muted);
}

/* Trigger is a fixed 36px tall; shrink the left padding so the avatar sits near the edge */
.profile-button {
  padding-left: var(--space-1);
}

/* 28px avatar fits inside the 36px trigger with --space-1 breathing room */
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--control-height) - var(--space-2));
  height: calc(var(--control-height) - var(--space-2));
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-surface);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.025em;
}

.profile-name {
  font-weight: var(--weight-medium);
  color: var(--color-text);
}

/* Negative top margin cancels the menu's --space-1 top padding so the tinted header touches the panel edge */
.dropdown-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: calc(-1 * var(--space-1));
  padding: var(--space-4);
  background: var(--color-bg);
}

/* 48px = --space-12 */
.avatar-large {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--space-12);
  height: var(--space-12);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-surface);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.025em;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  margin-bottom: var(--space-1);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.user-email {
  overflow: hidden;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-divider {
  height: 1px;
  margin: var(--space-1) 0;
  background: var(--color-border);
}

.dropdown-item svg {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.dropdown-item.logout,
.dropdown-item.logout svg {
  color: var(--color-danger);
}

.dropdown-item.logout:hover {
  background: var(--color-danger-soft);
}

/* Pill counter pushed to the right edge of the "My tasks" row */
.task-badge {
  min-width: var(--space-5);
  margin-left: auto;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-surface);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  line-height: var(--space-5);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
