<script lang="ts" setup>
import { ViewLockType, type ViewType } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    view?: ViewType
    showIcon?: boolean
    showUnlockButton?: boolean
  }>(),
  {
    showIcon: true,
    showUnlockButton: true,
  },
)

const emits = defineEmits(['onOpen'])

const { isUIAllowed } = useRoles()

const { activeView } = storeToRefs(useViewsStore())

const view = computed(() => props.view || activeView.value)

const handleUnlockView = () => {
  emits('onOpen')
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgLockView'), {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}
</script>

<template>
  <div
    class="nc-locked-view-footer flex items-center gap-1 bg-nc-bg-gray-light pl-3 pr-2 py-1.5 text-nc-content-gray-subtle2 text-small leading-[18px]"
  >
    <slot name="icon">
      <component
        :is="viewLockIcons[view.lock_type].icon"
        v-if="view?.lock_type && showIcon"
        class="flex-none"
        :class="{
          'w-4 h-4': view?.lock_type === ViewLockType.Locked,
          'w-3.5 h-3.5': view?.lock_type !== ViewLockType.Locked,
        }"
      />
    </slot>

    <div class="flex-1">
      <slot name="title">
        {{
          $t('title.thisViewIsLockType', {
            type: $t(viewLockIcons[view?.lock_type]?.title).toLowerCase(),
          })
        }}
      </slot>
    </div>

    <NcButton
      v-if="view?.lock_type === ViewLockType.Locked && isUIAllowed('fieldAdd') && showUnlockButton"
      type="text"
      size="xs"
      class="!text-nc-content-brand !hover:bg-nc-bg-gray-medium"
      @click="handleUnlockView"
    >
      <div class="flex items-center gap-1">
        <GeneralIcon icon="ncUnlock" class="flex-none" />

        {{ $t('general.unlock') }}
      </div>
    </NcButton>
  </div>
</template>
