<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const isExpanded = ref(false)

const onExpand = async () => {
  // loadAutomations({ baseId: baseId.value })
  // isOptionsOpen.value = !isOptionsOpen.value
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="nc-tree-item nc-automation-node-wrapper nc-project-home-section text-sm select-none w-full nc-base-tree-automation">
    <div v-e="['c:dashboard:toggle-expand']" class="nc-project-home-section-header w-full cursor-pointer" @click.stop="onExpand">
      <div>Dashboards</div>
      <div class="flex-1" />
      <GeneralIcon
        icon="chevronRight"
        class="flex-none nc-sidebar-source-node-btns text-nc-content-gray-muted cursor-pointer transform transition-transform duration-200 text-[20px]"
        :class="{ '!rotate-90': isExpanded }"
      />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
