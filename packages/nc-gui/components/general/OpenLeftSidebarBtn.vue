<script lang="ts" setup>
const { isLeftSidebarOpen: _isLeftSidebarOpen } = storeToRefs(useSidebarStore())
const isLeftSidebarOpen = ref(_isLeftSidebarOpen.value)

const { isMobileMode } = useGlobal()

watch(_isLeftSidebarOpen, (val) => {
  if (val) {
    isLeftSidebarOpen.value = true
  } else {
    setTimeout(() => {
      isLeftSidebarOpen.value = false
    }, 300)
  }
})

const onClick = () => {
  if (_isLeftSidebarOpen.value) return

  _isLeftSidebarOpen.value = !_isLeftSidebarOpen.value
}
</script>

<template>
  <NcTooltip
    placement="topLeft"
    hide-on-click
    class="transition-all duration-100"
    :class="{
      '!w-0 !opacity-0': isLeftSidebarOpen,
      '!w-8 !opacity-100': !isLeftSidebarOpen,
    }"
  >
    <template #title>
      {{
        isLeftSidebarOpen
          ? `${$t('general.hide')} ${$t('objects.sidebar').toLowerCase()}`
          : `${$t('general.show')} ${$t('objects.sidebar').toLowerCase()}`
      }}
    </template>
    <NcButton
      :type="isMobileMode ? 'secondary' : 'text'"
      size="small"
      class="nc-sidebar-left-toggle-icon !text-gray-600 !hover:text-gray-800"
      :class="{
        'invisible !w-0': isLeftSidebarOpen,
      }"
      @click="onClick"
    >
      <div class="flex items-center text-inherit">
        <GeneralIcon v-if="isMobileMode" icon="menu" />
        <GeneralIcon v-else icon="doubleRightArrow" class="duration-150 transition-all !text-lg -mt-0.25" />
      </div>
    </NcButton>
  </NcTooltip>
</template>
