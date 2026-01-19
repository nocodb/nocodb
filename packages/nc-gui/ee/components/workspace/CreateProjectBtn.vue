<script setup lang="ts">
import type { ButtonType } from 'ant-design-vue/lib/button'

const props = defineProps<{
  activeWorkspaceId?: string
  modal?: boolean
  type?: ButtonType
  size?: NcButtonSize
  centered?: boolean
  // isOpen: boolean
}>()

const { isUIAllowed } = useRoles()

const { baseCreateMode } = storeToRefs(useBases())

const baseStore = useBase()
const { isSharedBase } = storeToRefs(baseStore)

const workspaceStore = useWorkspace()
const { activeWorkspaceId: _activeWorkspaceId } = storeToRefs(workspaceStore)

const baseCreateDlg = ref(false)

const isVisibleCreateBase = ref(false)

const size = computed(() => props.size || 'small')
const centered = computed(() => props.centered ?? true)
</script>

<template>
  <NcDropdown v-if="isUIAllowed('baseCreate') && !isSharedBase" v-model:visible="isVisibleCreateBase">
    <NcButton v-e="['c:base:create']" type="text" :size="size" :centered="centered" full-width>
      <slot>
        <div class="flex items-center gap-2 w-full">
          <GeneralIcon icon="ncPlusCircleSolid" />

          <div class="flex flex-1">{{ $t('title.createBase') }}</div>

          <div
            class="px-1 flex-none text-bodySmBold !leading-[18px] text-nc-content-gray-subtle bg-nc-bg-gray-medium rounded">
            {{ renderAltOrOptlKey(true) }} D
          </div>
        </div>
      </slot>

      <WorkspaceCreateProjectDlg v-model="baseCreateDlg" :default-base-create-mode="baseCreateMode" />
    </NcButton>
    <template #overlay>
      <WorkspaceProjectCreateMenu v-model:visible="isVisibleCreateBase" v-model:base-create-mode="baseCreateMode"
        @update:base-create-mode="baseCreateDlg = true" variant="dropdown" />
    </template>
  </NcDropdown>
</template>

<style scoped></style>
