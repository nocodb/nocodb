<script lang="ts" setup>
const { returnTo, isReturnVisible, goBack } = useSidebarReturn()
</script>

<template>
  <div v-if="isReturnVisible && returnTo" class="flex items-center flex-none">
    <NcTooltip :title="$t('labels.backTo', { name: returnTo.label })" placement="bottom">
      <button
        v-e="['c:topbar:back:navigate']"
        type="button"
        class="nc-topbar-back-btn"
        data-testid="nc-topbar-back-btn"
        @click="goBack"
      >
        <GeneralIcon icon="ncArrowLeft" class="w-3.5 h-3.5" />
        {{ $t('general.back') }}
      </button>
    </NcTooltip>
    <div class="w-px h-5 ml-1 mr-1.5 bg-nc-border-gray-medium" />
  </div>
</template>

<style lang="scss" scoped>
.nc-topbar-back-btn {
  @apply h-[30px] pl-2 pr-2.5 flex items-center gap-1.5 rounded-lg text-[13px] font-600 text-nc-content-brand bg-nc-bg-brand transition-colors duration-150;
  border: 1px solid var(--color-brand-200);

  &:hover {
    border-color: var(--color-brand-400);
  }
}
</style>
