<script lang="ts" setup>
const emits = defineEmits(['onOpen'])

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
    class="flex items-center gap-2 bg-nc-bg-gray-light pl-3 pr-2 py-1.5 text-nc-content-gray-subtle2 text-small leading-[18px]"
  >
    <GeneralIcon icon="ncLock" class="flex-none" />

    <div class="flex-1">{{ $t('title.thisViewIsLocked') }}</div>

    <NcButton type="text" size="xs" class="!text-nc-content-brand !hover:bg-nc-bg-gray-medium" @click="handleUnlockView">
      <template #icon>
        <GeneralIcon icon="ncUnlock" class="flex-none" />
      </template>
      {{ $t('general.unlock') }}
    </NcButton>
  </div>
</template>

<style lang="scss" scoped></style>
