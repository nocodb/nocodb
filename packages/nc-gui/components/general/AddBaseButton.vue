<script setup lang="ts">
const { isUIAllowed } = useUIPermission()

const { t } = useI18n()

const toggleDialog = inject(ToggleDialogInj, () => {})
</script>

<template>
  <div
    v-if="isUIAllowed('settings')"
    class="flex items-center w-full pl-3 hover:(text-primary bg-primary bg-opacity-5)"
    @click="toggleDialog(true, undefined, undefined, projectId)"
  >
    <div>
      <div class="flex items-center space-x-1">
        <RiTeamFill class="mr-1 nc-new-base" />
        <div>{{ t('title.teamAndSettings') }}</div>
      </div>
    </div>
  </div>
</template>
