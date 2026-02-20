<script lang="ts" setup>
import type { DocType } from 'nocodb-sdk'

interface Props {
  doc: DocType
}

const props = defineProps<Props>()

const { $e } = useNuxtApp()
const { t } = useI18n()

const { ncNavigateTo } = useGlobal()
const { isUIAllowed } = useRoles()

const docsStore = useDocsStore()
const basesStore = useBases()
const { activeProjectId } = storeToRefs(basesStore)
const { updateDoc, deleteDoc } = docsStore
const { activeDocId } = storeToRefs(docsStore)

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const base = inject(ProjectInj, ref())

const isEditing = ref(false)
const isDropdownOpen = ref(false)
const editTitle = ref('')
const input = ref<HTMLInputElement>()

const navigateToDoc = () => {
  if (isEditing.value) return

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: base.value?.id || props.doc.base_id,
    docId: props.doc.id,
    docTitle: props.doc.title,
  })
}

const onClick = useDebounceFn(() => {
  navigateToDoc()
}, 250)

const onDblClick = () => {
  if (!isUIAllowed('docUpdate')) return

  isEditing.value = true
  editTitle.value = props.doc.title || ''
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
  })
}

const onRename = async () => {
  if (!editTitle.value.trim()) {
    editTitle.value = props.doc.title || 'Untitled'
  }

  if (editTitle.value !== props.doc.title && base.value?.id) {
    await updateDoc(base.value.id, props.doc.id!, { title: editTitle.value, version: props.doc.version })
  }

  isEditing.value = false
}

const onDelete = async () => {
  if (!base.value?.id) return
  await deleteDoc(base.value.id, props.doc.id!)
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    onRename()
  } else if (e.key === 'Escape') {
    isEditing.value = false
    editTitle.value = props.doc.title || ''
  }
}
</script>

<template>
  <div class="nc-page-node flex items-center gap-1 py-0.5 pl-2 pr-1 cursor-pointer group" @click="onClick" @dblclick="onDblClick">
    <GeneralIcon icon="ncFileText" class="flex-none text-nc-content-gray-muted !h-4 !w-4" />

    <input
      v-if="isEditing"
      ref="input"
      v-model="editTitle"
      class="flex-1 min-w-0 outline-none bg-transparent text-sm"
      @blur="onRename"
      @keydown="onKeydown"
      @click.stop
    />
    <span v-else class="flex-1 min-w-0 truncate text-sm">{{ doc.title || 'Untitled' }}</span>

    <NcDropdown v-if="isUIAllowed('docDelete') && !isEditing" v-model:visible="isDropdownOpen" placement="bottomRight">
      <NcButton
        type="text"
        size="xxsmall"
        class="nc-page-node-menu !opacity-0 group-hover:!opacity-100"
        :class="{ '!opacity-100': isDropdownOpen }"
        @click.stop
      >
        <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted" />
      </NcButton>
      <template #overlay>
        <NcMenu variant="medium">
          <NcMenuItem @click="onDblClick">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="rename" />
              Rename
            </div>
          </NcMenuItem>
          <NcDivider />
          <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="onDelete">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="delete" />
              Delete
            </div>
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>
