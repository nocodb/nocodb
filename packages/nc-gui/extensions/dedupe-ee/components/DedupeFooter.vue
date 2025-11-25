<script lang="ts" setup>
import { useDedupeOrThrow } from '../lib/useDedupe'

const { currentStep, groupSets, isLoadingGroupSets } = useDedupeOrThrow()

const { toggleFullScreen } = useExtensionHelperOrThrow()

const onCancel = () => {
  if (currentStep.value === 'review') {
    currentStep.value = 'config'
  } else {
    toggleFullScreen()
  }
}
</script>

<template>
  <div class="w-full flex items-center justify-between gap-3 px-4 pt-[11px] pb-3 border-t-1 border-nc-border-gray-medium">
    <div></div>
    <div class="flex items-center gap-2">
      <NcButton size="small" type="secondary" @click="onCancel"> {{ $t('general.cancel') }} </NcButton>
      <NcButton
        v-if="currentStep === 'config'"
        size="small"
        :disabled="isLoadingGroupSets || !groupSets.length"
        @click="currentStep = 'review'"
      >
        Review {{ groupSets.length ?? '' }} set of duplicates
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
