<script setup lang="ts">
const { t } = useI18n()

const activeMenu = ref('snapshots')

const selectMenu = (option: string) => {
  activeMenu.value = option
}

const options: { key: string; label: string; icon: keyof typeof iconMap }[] = [
  {
    key: 'snapshots',
    label: t('general.snapshots'),
    icon: 'camera',
  },
  {
    key: 'visibility',
    label: t('labels.visibilityAndDataHandling'),
    icon: 'ncEye',
  },
]
</script>

<template>
  <div class="flex p-4 justify-center overflow-auto gap-8">
    <!-- Left Pane -->
    <div class="flex flex-col">
      <div class="h-full w-60">
        <div
          v-for="option in options"
          :key="option.key"
          :class="{
            'active-menu': activeMenu === option.key,
          }"
          class="gap-3 !hover:bg-gray-50 transition-all text-nc-content-gray flex rounded-lg items-center cursor-pointer py-1.5 px-3"
          @click="selectMenu(option.key)"
        >
          <GeneralIcon :icon="option.icon" />

          <span>
            {{ option.label }}
          </span>
        </div>
      </div>
    </div>
    <!-- Data Pane -->

    <div class="flex flex-col py-4 w-[800px]">
      <DashboardSettingsBaseSettingsSnapshots v-if="activeMenu === 'snapshots'" />
      <DashboardSettingsBaseSettingsVisibility v-if="activeMenu === 'visibility'" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.active-menu {
  @apply !bg-brand-50 font-semibold !text-brand-500;
}
</style>
