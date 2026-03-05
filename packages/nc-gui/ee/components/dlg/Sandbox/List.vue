<script setup lang="ts">
import type { BaseType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  base: BaseType
}>()

const emit = defineEmits(['update:modelValue', 'createSandbox'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { $api } = useNuxtApp()

const { t } = useI18n()

const { user } = useGlobal()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const basesStore = useBases()
const { bases, basesUser } = storeToRefs(basesStore)

const baseUsers = computed(() => (props.base?.id ? basesUser.value.get(props.base.id) || [] : []))

const { navigateToProject } = useGlobal()

// State
const sandboxes = ref<any[]>([])
const isLoading = ref(false)
const error = ref('')

const loadSandboxes = async () => {
  if (!props.base?.id || !activeWorkspaceId.value) return

  isLoading.value = true
  error.value = ''

  try {
    const response = (await $api.internal.getOperation(activeWorkspaceId.value, props.base.id, {
      operation: 'sandboxList',
    })) as any[]

    sandboxes.value = response || []
  } catch (e: any) {
    error.value = await extractSdkResponseErrorMsg(e)
    sandboxes.value = []
  } finally {
    isLoading.value = false
  }
}

const getSandboxBase = (sandbox: any) => {
  return bases.value.get(sandbox.sandbox_base_id)
}

const goToSandbox = (sandbox: any) => {
  navigateToProject({
    workspaceId: activeWorkspaceId.value,
    baseId: sandbox.sandbox_base_id,
    type: 'database',
  })
  dialogShow.value = false
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return t('labels.justNow')
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

const handleCreateSandbox = () => {
  dialogShow.value = false
  emit('createSandbox')
}

const getUserDisplay = (userId: string) => {
  const matchedUser = baseUsers.value.find((u) => u.id === userId)
  if (matchedUser) {
    return matchedUser.display_name || matchedUser.email || t('labels.unknownUser')
  }
  return t('labels.unknownUser')
}

const isDeleting = ref<string | null>(null)

const deleteSandbox = async (sandbox: any) => {
  if (!sandbox.sandbox_base_id || !activeWorkspaceId.value) return

  isDeleting.value = sandbox.id

  try {
    await $api.internal.postOperation(activeWorkspaceId.value, sandbox.sandbox_base_id, {
      operation: 'sandboxDelete',
    })

    // Remove from local list
    sandboxes.value = sandboxes.value.filter((s) => s.id !== sandbox.id)
  } catch (e: any) {
    error.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isDeleting.value = null
  }
}

watch(
  dialogShow,
  (newVal) => {
    if (newVal) {
      loadSandboxes()
    }
  },
  { immediate: true },
)
</script>

<template>
  <GeneralModal
    v-if="base"
    v-model:visible="dialogShow"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    class="!w-[28rem]"
    wrap-class-name="nc-modal-sandbox-list"
  >
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-50">
            <GeneralIcon icon="ncGitBranch" class="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <div class="text-base text-nc-content-gray-emphasis font-bold">{{ t('labels.allSandboxes') }}</div>
            <div class="text-sm text-nc-content-gray-muted">{{ t('labels.manageSandboxesFor', { title: base.title }) }}</div>
          </div>
        </div>
        <NcButton type="text" size="xsmall" class="!px-1" @click="dialogShow = false">
          <GeneralIcon icon="close" class="text-nc-content-gray-muted" />
        </NcButton>
      </div>

      <!-- Content -->
      <div class="p-2">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <GeneralLoader size="large" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="text-center py-8 text-red-600">
          {{ error }}
        </div>

        <!-- Empty -->
        <div v-else-if="sandboxes.length === 0" class="text-center py-8 text-nc-content-gray-muted">
          {{ t('labels.noSandboxesFound') }}
        </div>

        <!-- Sandbox List -->
        <div v-else class="flex flex-col gap-2">
          <div
            v-for="sandbox in sandboxes"
            :key="sandbox.id"
            class="flex items-start gap-3 p-4 bg-nc-bg-gray-extralight rounded-lg cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
            @click="goToSandbox(sandbox)"
          >
            <!-- Icon -->
            <div class="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-100 flex-shrink-0">
              <GeneralIcon icon="ncGitBranch" class="w-4 h-4 text-orange-600" />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0 flex flex-col gap-1">
              <!-- Title -->
              <div class="font-semibold text-sm text-nc-content-gray-emphasis truncate leading-5">
                {{ getSandboxBase(sandbox)?.title || t('labels.sandbox') }}
              </div>

              <!-- Description -->
              <div class="text-xs text-nc-content-gray-muted truncate leading-4">
                {{ sandbox.meta?.description || t('labels.noDescriptionProvided') }}
              </div>

              <!-- Metadata row -->
              <div class="flex items-center gap-3 text-xs text-nc-content-gray-subtle">
                <div class="flex items-center gap-1.5">
                  <GeneralIcon icon="user" class="w-3.5 h-3.5" />
                  <span v-if="sandbox.created_by === user.id">{{ $t('general.you') }}</span>
                  <span v-else>
                    {{ getUserDisplay(sandbox.created_by) }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5">
                  <GeneralIcon icon="clock" class="w-3.5 h-3.5" />
                  <span>{{ formatDate(sandbox.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Actions dropdown -->
            <NcDropdown :trigger="['click']" placement="bottomRight" @click.stop>
              <NcButton type="text" size="xsmall" class="!px-1 flex-shrink-0" @click.stop>
                <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem danger @click.stop="deleteSandbox(sandbox)">
                    <GeneralLoader v-if="isDeleting === sandbox.id" size="small" />
                    <GeneralIcon v-else icon="delete" class="w-4 h-4" />
                    <span>{{ t('labels.deleteSandbox') }}</span>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex flex-row gap-x-2 justify-end mt-4">
        <NcButton type="primary" size="small" @click="handleCreateSandbox">
          <GeneralIcon icon="ncGitBranch" class="w-4 h-4 mr-1" />
          {{ t('labels.createSandbox') }}
        </NcButton>
      </div>
    </div>
  </GeneralModal>
</template>

<style scoped lang="scss">
:deep(.ant-modal-mask) {
  @apply !bg-black !bg-opacity-[8%];
}
</style>
