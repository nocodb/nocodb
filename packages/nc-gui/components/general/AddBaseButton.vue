<script setup lang="ts">
import { iconMap } from '#imports'

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const toggleDialog = inject(ToggleDialogInj, () => {})
</script>

<template>
  <div
    v-if="isUIAllowed('settingsPage')"
    class="flex items-center w-full pl-3 hover:(text-primary bg-primary bg-opacity-5)"
    @click="toggleDialog(true, undefined, undefined, baseId)"
  >
    <div>
      <div class="flex items-center space-x-1">
        <component :is="iconMap.users" class="mr-1 nc-new-source" />
        <div>{{ t('title.teamAndSettings') }}</div>
      </div>
    </div>
  </div>
</template>
