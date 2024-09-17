<script lang="ts" setup>
const { activeField } = useFormViewStoreOrThrow()

const isOpen = ref<boolean>(false)
</script>

<template>
  <div v-if="activeField" class="flex flex-col">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="text-gray-800 font-medium">{{ $t('labels.showOnConditions') }}</div>

        <div class="flex flex-col">
          <NcTooltip placement="left">
            <template #title>
              <div class="text-center">
                {{ $t('msg.info.thisFeatureIsOnlyAvailableInEnterpriseEdition') }}
              </div>
            </template>
            <div
              class="nc-form-field-visibility-btn border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 !min-w-[170px] transition-all select-none text-sm opacity-50 cursor-not-allowed"
              :class="{
                '!border-brand-500': isOpen,
                'border-gray-200': !isOpen,
              }"
            >
              <div class="nc-form-field-visibility-conditions-count flex-1">No conditions</div>

              <GeneralIcon icon="settings" class="flex-none w-4 h-4" />
            </div>
          </NcTooltip>
        </div>
      </div>
      <div>
        <div class="text-sm text-gray-500">{{ $t('labels.showFieldOnConditionsMet') }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

<style lang="scss">
.nc-form-field-visibility-dropdown {
  @apply rounded-2xl border-gray-200;
  box-shadow: 0px 20px 24px -4px rgba(0, 0, 0, 0.1), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}
</style>
