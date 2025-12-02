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

const baseStore = useBase()
const { isSharedBase } = storeToRefs(baseStore)

const workspaceStore = useWorkspace()
const { activeWorkspaceId: _activeWorkspaceId } = storeToRefs(workspaceStore)

const baseCreateDlg = ref(false)

const size = computed(() => props.size || 'small')
const centered = computed(() => props.centered ?? true)
</script>

<template>
  <NcButton
    v-if="isUIAllowed('baseCreate') && !isSharedBase"
    v-e="['c:base:create']"
    type="text"
    :size="size"
    :centered="centered"
    full-width
    @click="baseCreateDlg = true"
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

    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
  </NcButton>
</template>

<style scoped></style>
