<script lang="ts" setup>
const { isShowEveryonePersonalViewsEnabled } = storeToRefs(useViewsStore())

const { isFeatureEnabled } = useBetaFeatureToggle()

const isVisible = ref(false)

const isEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.SHOW_EVERYONES_PERSONAL_VIEWS))
</script>

<template>
  <NcDropdown v-if="isEnabled" v-model:visible="isVisible">
    <NcButton
      size="small"
      type="text"
      class="!text-nc-content-gray-muted !md:(hover:bg-nc-bg-gray-medium) !rounded-md"
      @click.stop
    >
      <GeneralIcon icon="ncSettings" class="!text-current" />
    </NcButton>
    <template #overlay>
      <div class="p-4 flex flex-col gap-3">
        <div class="!capitalize text-captionBold font-semibold text-nc-content-gray-subtle2">
          {{ $t('general.options') }}
        </div>
        <div
          class="flex items-center text-bodyDefaultSm text-nc-content-gray-muted hover:text-nc-content-gray-subtle2 select-none"
        >
          <NcSwitch v-model:checked="isShowEveryonePersonalViewsEnabled" size="xsmall">
            {{ $t('labels.showEveryonesPersonalViews') }}
          </NcSwitch>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>
