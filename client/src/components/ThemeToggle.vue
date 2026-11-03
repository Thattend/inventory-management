<template>
  <button
    type="button"
    class="icon-btn theme-toggle"
    :aria-label="label"
    :aria-pressed="isDark"
    :title="label"
    @click="toggleTheme"
  >
    <!-- Sun while dark (action: go light), moon while light -->
    <svg v-if="isDark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme'
import { useI18n } from '../composables/useI18n'

const { isDark, toggleTheme } = useTheme()
const { t } = useI18n()
const label = computed(() => (isDark.value ? t('theme.switchToLight') : t('theme.switchToDark')))
</script>
