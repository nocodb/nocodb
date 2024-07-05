<script setup lang="ts">
const props = defineProps<{
  value: boolean
}>()

const dialogShow = useVModel(props, 'value')

const activeMenu = ref('local')

const selectMenu = (option: string) => {
  activeMenu.value = option
}
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    size="medium"
    wrap-class-name="nc-modal-attachment-create"
    class="!rounded-md"
    @keydown.esc="dialogShow = false"
  >
    <div class="flex flex-row">
      <NcMenu>
        <NcMenuItem
          key="local"
          :class="{
            'active-menu': activeMenu === 'local',
          }"
          @click="selectMenu('local')"
        >
          Local Files
        </NcMenuItem>
        <NcMenuItem
          key="url"
          :class="{
            'active-menu': activeMenu === 'url',
          }"
          @click="selectMenu('url')"
        >
          Upload via URL
        </NcMenuItem>
        <NcMenuItem
          key="webcam"
          :class="{
            'active-menu': activeMenu === 'webcam',
          }"
          @click="selectMenu('webcam')"
        >
          Webcam
        </NcMenuItem>
      </NcMenu>

      <div></div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-attachment-create {
  .active-menu {
    @apply !bg-gray-100 rounded-md;
  }

  :deep(.ant-menu-vertical-left) {
    border-right: none !important;
  }
}
</style>
