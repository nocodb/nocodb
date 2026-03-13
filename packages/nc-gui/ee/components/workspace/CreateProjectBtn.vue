<script setup lang="ts">
import type { ButtonType } from 'ant-design-vue/lib/button'

const props = withDefaults(
  defineProps<{
    workspaceId?: string
    modal?: boolean
    type?: ButtonType
    size?: NcButtonSize
    centered?: boolean
    innerClass?: string
    // isOpen: boolean
  }>(),
  {
    type: 'text',
  },
)

const { workspaceId } = toRefs(props)

const { isUIAllowed } = useRoles()

const { activeWorkspaceId, workspaces } = storeToRefs(useWorkspace())

const { baseCreateMode } = storeToRefs(useBases())

const baseStore = useBase()
const { isSharedBase } = storeToRefs(baseStore)

const baseCreateDlg = ref(false)

const isVisibleCreateBase = ref(false)

const size = computed(() => props.size || 'small')
const centered = computed(() => props.centered ?? true)

const hasAccess = computed(() => {
  if (!workspaceId.value || workspaceId.value === activeWorkspaceId.value) return isUIAllowed('baseCreate') && !isSharedBase.value

  return isUIAllowed('baseCreate', { roles: workspaces.value.get(workspaceId.value)?.roles })
})
</script>

<template>
  <NcDropdown v-if="hasAccess" v-model:visible="isVisibleCreateBase">
    <NcButton
      v-e="['c:base:create']"
      :type="type"
      data-testid="nc-sidebar-create-base-btn"
      :size="size"
      :centered="centered"
      :inner-class="innerClass"
      full-width
    >
      <slot>
        <div class="flex items-center gap-2 w-full">
          <GeneralIcon icon="ncPlusCircleSolid" />

          <div class="flex flex-1">{{ $t('title.createBase') }}</div>

          <div class="px-1 flex-none text-bodySmBold !leading-[18px] text-nc-content-gray-subtle bg-nc-bg-gray-medium rounded">
            {{ renderAltOrOptlKey(true) }} D
          </div>
        </div>
      </slot>

      <WorkspaceCreateProjectDlg v-model="baseCreateDlg" :default-base-create-mode="baseCreateMode" :workspace-id="workspaceId" />
    </NcButton>
    <template #overlay>
      <WorkspaceProjectCreateMenu
        v-model:visible="isVisibleCreateBase"
        v-model:base-create-mode="baseCreateMode"
        variant="dropdown"
        :workspace-id="workspaceId"
        @update:base-create-mode="baseCreateDlg = true"
      />
    </template>
  </NcDropdown>
</template>
