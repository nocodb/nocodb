<script setup lang="ts">
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const { ncNavigateTo } = useGlobal()

const workspaceStore = useWorkspace()

const automationStore = useAutomationStore()

const { loadAutomations } = automationStore

const { isAutomationActive, activeAutomationId, activeAutomation, automations } = storeToRefs(automationStore)

const { activeWorkspaceId } = storeToRefs(workspaceStore)
const bases = useBases()

const { openedProject } = storeToRefs(bases)

const isAutomationOpened = computed(() => {
  return isAutomationActive.value && openedProject.value?.id === baseId.value
})

const isAutomationsLoading = ref(false)

const isOptionsOpen = ref(false)

const isExpanded = ref(false)

const openAutomations = () => {
  if (!isExpanded.value) {
    loadAutomations({ baseId: baseId.value })
    isOptionsOpen.value = true
    isExpanded.value = true
  } else if (isExpanded.value && isNewSidebarEnabled.value) {
    isOptionsOpen.value = false
    isExpanded.value = false
  }

  if (isNewSidebarEnabled.value) return

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value ?? 'nc',
    automation: true,
    baseId: baseId.value,
  })
}

const onExpand = async () => {
  loadAutomations({ baseId: baseId.value })
  isOptionsOpen.value = !isOptionsOpen.value
  isExpanded.value = !isExpanded.value
}

watch(
  () => activeAutomation.value?.id,
  async () => {
    if (!activeAutomation.value) return

    await loadAutomations({ baseId: baseId.value })

    if (activeAutomation.value?.base_id === openedProject.value?.id) {
      isExpanded.value = true
    }
  },
  {
    immediate: true,
  },
)

let automationTimeout: NodeJS.Timeout

watch(activeAutomationId, () => {
  loadAutomations({ baseId: baseId.value })

  if (automationTimeout) {
    clearTimeout(automationTimeout)
  }

  if (activeAutomationId.value && isExpanded.value) {
    const _automations = automations.value.get(baseId.value) ?? []

    if (_automations.length) return

    automationTimeout = setTimeout(() => {
      if (isExpanded.value) {
        isExpanded.value = false
      }
      clearTimeout(automationTimeout)
    }, 10000)
  }
})
</script>

<template>
  <div
    class="nc-tree-item nc-automation-node-wrapper text-sm select-none w-full nc-base-tree-automation"
    :class="{
      'nc-automation-node-wrapper': !isNewSidebarEnabled,
      'nc-project-home-section': isNewSidebarEnabled,
    }"
  >
    <div v-if="!isNewSidebarEnabled" class="flex items-center py-0.5">
      <div
        v-e="['a:automation:open']"
        class="flex-none flex-1 pl-7.5 xs:(pl-6) flex items-center gap-1 h-full nc-tree-item-inner nc-sidebar-node pr-0.75 mb-0.25 rounded-md h-7 w-full group cursor-pointer hover:bg-gray-200"
        :class="{
          'hover:bg-gray-200': false,
          '!bg-primary-selected': isAutomationOpened,
        }"
        @click="openAutomations"
      >
        <div class="flex flex-row h-full items-center">
          <div class="flex w-auto">
            <GeneralLoader v-if="isAutomationsLoading" class="flex items-center w-6 h-full !text-gray-600" />

            <LazyGeneralEmojiPicker v-else size="small" :readonly="true">
              <template #default>
                <GeneralIcon
                  icon="ncAutomation"
                  class="w-4 text-sm"
                  :class="isAutomationOpened ? '!text-brand-600/85' : '!text-gray-600/75'"
                />
              </template>
            </LazyGeneralEmojiPicker>
          </div>
        </div>

        <div
          :class="isAutomationOpened ? 'text-brand-600 !font-semibold' : 'text-gray-700'"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          Automations
        </div>
        <div class="flex-1" />

        <div class="flex items-center">
          <NcButton
            v-e="['c:automation:toggle-expand']"
            type="text"
            size="xxsmall"
            class="nc-sidebar-node-btn nc-sidebar-expand !xs:opacity-100"
            :class="{
              '!opacity-100': isOptionsOpen,
            }"
            @click.stop="onExpand"
          >
            <GeneralIcon
              icon="chevronRight"
              class="flex-none nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 text-[20px]"
              :class="{ '!rotate-90': isExpanded }"
            />
          </NcButton>
        </div>
      </div>
    </div>
    <div
      v-else
      v-e="['c:automation:toggle-expand']"
      class="nc-project-home-section-header w-full cursor-pointer"
      @click.stop="onExpand"
    >
      <div>Automations</div>
      <div class="flex-1" />
      <div class="flex items-center">
        <NcButton
          type="text"
          size="xxsmall"
          class="nc-sidebar-node-btn nc-sidebar-expand !opacity-100 !xs:opacity-100"
          @click.stop="onExpand"
        >
          <GeneralIcon
            icon="chevronRight"
            class="flex-none nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 text-[20px]"
            :class="{ '!rotate-90': isExpanded }"
          />
        </NcButton>
      </div>
    </div>
    <DashboardTreeViewAutomationList v-if="isExpanded" :base-id="baseId!" />
  </div>
</template>
