<script setup lang="ts">
import tinycolor from 'tinycolor2'
import { type BaseType, WorkspaceUserRoles } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  base: BaseType
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { navigateToProject } = useGlobal()

const { refreshCommandPalette } = useCommandPalette()

const { api } = useApi()

const { $e, $poller } = useNuxtApp()

const basesStore = useBases()

const { workspacesList, activeWorkspace } = useWorkspace()

const { loadProjects, createProject: _createProject } = basesStore

const options = ref({
  includeData: true,
  includeViews: true,
  includeHooks: true,
  includeComments: true,
})
const targetWorkspace = ref(activeWorkspace)

const errorMessage = ref()

// Used to handle different Action in different states in Modal
// pending -> Initial state
// loading -> Set when duplicate is triggered
const status = ref<'pending' | 'success' | 'error' | 'loading'>('pending')

const isEaster = ref(false)

const dropdownOpen = ref(false)

const optionsToExclude = computed(() => {
  const { includeData, includeViews, includeHooks, includeComments } = options.value
  return {
    excludeData: !includeData,
    excludeViews: !includeViews,
    excludeHooks: !includeHooks,
    excludeComments: !includeComments,
  }
})

const workspaceOptions = computed(() => {
  if (!isEeUI) return []
  return workspacesList.filter((ws) =>
    [WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(ws.roles as WorkspaceUserRoles),
  )
})

const isLoading = computed(() => status.value === 'loading')

const targetBase = ref()

const _duplicate = async () => {
  try {
    status.value = 'loading'
    // pick a random color from array and assign to base
    const color = baseThemeColors[Math.floor(Math.random() * 1000) % baseThemeColors.length]
    const tcolor = tinycolor(color)

    const complement = tcolor.complement()

    const jobData = await api.base.duplicate(props.base.id as string, {
      options: optionsToExclude.value,
      base: {
        fk_workspace_id: isEeUI ? (targetWorkspace.value?.id ? targetWorkspace.value.id : props.base.fk_workspace_id) : null,
        type: props.base.type,
        color,
        meta: JSON.stringify({
          theme: {
            primaryColor: color,
            accentColor: complement.toHex8String(),
          },
          iconColor: parseProp(props.base.meta).iconColor,
        }),
      },
    })

    $poller.subscribe(
      { id: jobData.id },
      async (data: {
        id: string
        status?: string
        data?: {
          error?: {
            message: string
          }
          message?: string
          result?: any
        }
      }) => {
        if (data.status !== 'close') {
          if (data.status === JobStatus.COMPLETED) {
            const resBases = await loadProjects('workspace', targetWorkspace?.value?.id)
            targetBase.value = resBases.find((b) => b.id === jobData.base_id)
            status.value = 'success'

            refreshCommandPalette()
          } else if (data.status === JobStatus.FAILED) {
            status.value = 'error'
            await loadProjects('workspace')
            refreshCommandPalette()
          }
        }
      },
    )

    $e('a:base:duplicate')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    errorMessage.value = await extractSdkResponseErrorMsg(e)
    status.value = 'error'
    dialogShow.value = false
  }
}

const selectOption = (option: WorkspaceType) => {
  targetWorkspace.value = option
  dropdownOpen.value = false
}

const handleActionClick = () => {
  switch (status.value) {
    case 'pending': {
      _duplicate()
      break
    }
    case 'error': {
      targetBase.value = null
      errorMessage.value = null
      status.value = 'pending'
      break
    }
    case 'success': {
      const base = targetBase.value
      navigateToProject({
        workspaceId: isEeUI ? base.fk_workspace_id : undefined,
        baseId: base.id,
        type: base.type,
      })
      dialogShow.value = false
      break
    }
  }
}

watch(dialogShow, (newVal) => {
  if (!newVal) {
    status.value = 'pending'
  }
})

onKeyStroke('Enter', () => {
  // should only trigger this when our modal is open
  if (dialogShow.value) {
    _duplicate()
  }
})
</script>

<template>
  <GeneralModal
    v-if="base"
    v-model:visible="dialogShow"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    class="!w-[30rem]"
    wrap-class-name="nc-modal-base-duplicate"
  >
    <div>
      <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold self-center" @dblclick="isEaster = !isEaster">
        <template v-if="['pending', 'loading'].includes(status)">
          {{ $t('labels.duplicateBaseBaseTitle', { baseTitle: base.title }) }}
        </template>

        <template v-else-if="status === 'success'">
          <div class="flex items-center gap-2">
            <GeneralIcon class="text-white w-6 h-6" icon="checkFill" />
            <div class="text-nc-content-gray-emphasis font-semibold">
              {{ $t('labels.duplicateBaseSuccessfull') }}
            </div>
          </div>
        </template>
        <template v-else-if="status === 'error'">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-6 h-6" />
            <div class="text-nc-content-gray-emphasis font-semibold">
              {{ $t('labels.duplicateBaseFailed') }}
            </div>
          </div>
        </template>
      </div>

      <template v-if="['pending', 'loading'].includes(status)">
        <div class="mt-5 flex gap-3 flex-col">
          <div
            class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
            @click="options.includeData = !options.includeData"
          >
            <NcSwitch :checked="options.includeData" />
            {{ $t('labels.includeRecords') }}
          </div>

          <template v-if="isEaster">
            <div
              class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
              @click="options.includeViews = !options.includeViews"
            >
              <NcSwitch :checked="options.includeViews" />
              {{ $t('labels.includeView') }}
            </div>

            <div
              class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
              @click="options.includeHooks = !options.includeHooks"
            >
              <NcSwitch :checked="options.includeHooks" />
              {{ $t('labels.includeWebhook') }}
            </div>
          </template>

          <div
            class="flex gap-3 cursor-pointer leading-5 text-nc-content-gray font-medium items-center"
            @click="options.includeComments = !options.includeComments"
          >
            <NcSwitch :checked="options.includeComments" />
            {{ $t('labels.includeComments') }}
          </div>
        </div>

        <div
          :class="{
            'mb-5': !isEeUI,
          }"
          class="mt-5 text-nc-content-gray-subtle2 font-medium"
        >
          {{ $t('labels.baseDuplicateMessage') }}
        </div>

        <div v-if="isEeUI" class="mb-5">
          <NcDivider divider-class="!my-5" />

          <div class="text-nc-content-gray font-medium leading-5">
            {{ $t('labels.workspace') }}

            <NcDropdown v-model:visible="dropdownOpen" class="mt-2">
              <div
                class="rounded-lg border-1 transition-all cursor-pointer flex items-center border-nc-border-grey-medium h-8 py-1 gap-2 px-3"
                style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08)"
                :class="{
                  '!border-brand-500 !shadow-selected': dropdownOpen,
                }"
              >
                <GeneralWorkspaceIcon size="small" :workspace="targetWorkspace" />

                <div class="flex-1 capitalize truncate">
                  {{ targetWorkspace?.title }}
                </div>

                <div class="flex gap-2 items-center">
                  <div v-if="activeWorkspace?.id === targetWorkspace?.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                    {{ $t('labels.currentWorkspace') }}
                  </div>
                  <GeneralIcon
                    :class="{
                      'transform rotate-180': dropdownOpen,
                    }"
                    class="text-nc-content-gray transition-all w-4 h-4"
                    icon="ncChevronDown"
                  />
                </div>
              </div>

              <template #overlay>
                <NcList
                  :value="targetWorkspace"
                  :item-height="28"
                  close-on-select
                  class="nc-base-workspace-selection"
                  :min-items-for-search="6"
                  container-class-name="w-full"
                  :list="workspaceOptions"
                  option-label-key="title"
                >
                  <template #listHeader>
                    <div class="text-nc-content-gray-muted text-[13px] px-3 pt-2.5 pb-1.5 font-medium leading-5">
                      {{ $t('labels.duplicateBaseMessage') }}
                    </div>

                    <NcDivider />
                  </template>

                  <template #listItem="{ option }">
                    <div class="flex gap-2 w-full items-center" @click="selectOption(option)">
                      <GeneralWorkspaceIcon :workspace="option" size="small" />

                      <div class="flex-1 text-[13px] truncate font-semibold leading-5 capitalize w-full">
                        {{ option.title }}
                      </div>

                      <div class="flex items-center gap-2">
                        <div v-if="activeWorkspace?.id === option.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                          {{ $t('labels.currentWorkspace') }}
                        </div>
                        <GeneralIcon v-if="option.id === targetWorkspace?.id" class="text-brand-500 w-4 h-4" icon="ncCheck" />
                      </div>
                    </div>
                  </template>
                </NcList>
              </template>
            </NcDropdown>
          </div>
        </div>
      </template>

      <template v-else-if="status === 'success'">
        <div class="text-nc-content-gray-emphasis my-5 font-medium">
          Base <span class="font-bold leading-5">"{{ base.title }}"</span> has finished duplication.
        </div>
      </template>

      <template v-else-if="status === 'error'">
        <div class="text-nc-content-gray-emphasis my-5 font-medium">{{ $t('labels.errorMessage') }} {{ errorMessage }}</div>
      </template>
    </div>
    <div class="flex flex-row gap-x-2 justify-end">
      <NcButton v-if="!isLoading" key="back" type="secondary" size="small" @click="dialogShow = false">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton
        key="submit"
        v-e="['a:base:duplicate']"
        size="small"
        :loading="isLoading"
        :disabled="isLoading"
        @click="handleActionClick"
      >
        <template v-if="status === 'pending'"> {{ $t('general.duplicate') }} {{ $t('objects.project') }} </template>
        <template v-else-if="status === 'loading'"> Duplicating {{ $t('objects.project') }} </template>
        <template v-else-if="status === 'success'"> {{ $t('labels.goToBase') }} </template>
        <template v-else-if="status === 'error'"> {{ $t('labels.tryAgain') }} </template>
      </NcButton>
    </div>
  </GeneralModal>
</template>

<style scoped lang="scss">
:deep(.ant-modal-mask) {
  @apply !bg-black !bg-opacity-[8%];
}

.nc-list-root {
  @apply !w-[432px] !pt-0;
}
</style>

<style lang="scss">
.nc-base-workspace-selection {
  .nc-list {
    @apply !px-1;
    .nc-list-item {
      @apply !py-1;
    }
  }
}
</style>
