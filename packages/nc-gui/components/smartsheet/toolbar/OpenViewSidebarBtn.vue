<script lang="ts" setup>
const { isRightSidebarOpen: _isRightSidebarOpen } = storeToRefs(useSidebarStore())
const isRightSidebarOpen = ref(_isRightSidebarOpen.value)

watch(_isRightSidebarOpen, (val) => {
  if (val) {
    isRightSidebarOpen.value = true
  } else {
    setTimeout(() => {
      isRightSidebarOpen.value = false
    }, 300)
  }
})

const onClick = () => {
  if (_isRightSidebarOpen.value) return

  _isRightSidebarOpen.value = !_isRightSidebarOpen.value
}
</script>

<template>
  <NcTooltip
    placement="bottomLeft"
    hide-on-click
    class="transition-all duration-100"
    :class="{
      '!w-0 !opacity-0': isRightSidebarOpen,
      '!w-8 !opacity-100 mr-2': !isRightSidebarOpen,
    }"
  >
    <template #title>
      {{
        isRightSidebarOpen
          ? `${$t('general.hide')} ${$t('objects.sidebar').toLowerCase()}`
          : `${$t('general.show')} ${$t('objects.sidebar').toLowerCase()}`
      }}
    </template>
    <NcButton
      type="text"
      size="small"
      class="nc-sidebar-right-toggle-icon !text-gray-600 !hover:text-gray-800"
      :class="{
        'invisible !w-0': isRightSidebarOpen,
      }"
      @click="onClick"
    >
      <div class="flex items-center text-inherit">
        <GeneralIcon icon="doubleLeftArrow" class="duration-150 transition-all !text-lg -mt-0.25" />
      </div>
    </NcButton>
  </NcTooltip>
</template>
