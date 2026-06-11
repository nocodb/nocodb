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

const { basesUser } = storeToRefs(useBases())

const view = computed(() => props.view || activeView.value)

const lockMessage = computed(() => parseProp(view.value?.meta)?.lockedViewDescription || '')

// For personal views: resolve the owner's display name or email for the tooltip.
const personalViewOwnerLabel = computed(() => {
  if (view.value?.lock_type !== ViewLockType.Personal || !view.value?.owned_by) return ''
  const users = view.value.base_id ? basesUser.value.get(view.value.base_id) || [] : []
  const owner = users.find((u) => u.id === view.value!.owned_by)
  return owner?.display_name || owner?.email || ''
})

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

    <div class="flex-1 flex items-center gap-1">
      <slot name="title">
        {{
          $t('title.thisViewIsLockType', {
            type: $t(viewLockIcons[view?.lock_type]?.title).toLowerCase(),
          })
        }}
      </slot>
      <NcTooltip v-if="lockMessage || personalViewOwnerLabel" placement="top">
        <template #title>
          <div class="whitespace-pre-wrap max-w-80">{{ lockMessage || personalViewOwnerLabel }}</div>
        </template>
        <GeneralIcon icon="info" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted cursor-help -mt-0.5" />
      </NcTooltip>
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
