<script setup lang="ts">
import tinycolor from 'tinycolor2'
import { type BaseType, type WorkspaceType, WorkspaceUserRoles } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  base: BaseType
}>()

const emit = defineEmits(['update:modelValue'])

const { refreshCommandPalette } = useCommandPalette()

const { api } = useApi()

const { $e, $poller } = useNuxtApp()

const basesStore = useBases()

const { loadProjects, createProject: _createProject } = basesStore
const { bases } = storeToRefs(basesStore)

const { navigateToProject } = useGlobal()
const { workspacesList, activeWorkspace } = useWorkspace()

const dialogShow = useVModel(props, 'modelValue', emit)

const options = ref({
  includeData: true,
  includeViews: true,
  includeHooks: true,
  includeComments: true,
})
const targetWorkspace = ref(activeWorkspace)
const workspaceOptions = computed(() => {
  if (!isEeUI) return []
  return workspacesList.filter((ws) =>
    [WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(ws.roles as WorkspaceUserRoles),
  )
})

const status = ref<'pending' | 'success' | 'error' | 'loading'>('success')

const optionsToExclude = computed(() => {
  const { includeData, includeViews, includeHooks, includeComments } = options.value
  return {
    excludeData: !includeData,
    excludeViews: !includeViews,
    excludeHooks: !includeHooks,
    excludeComments: !includeComments,
  }
})

const isLoading = ref(false)

const _duplicate = async () => {
  try {
    isLoading.value = true
    // pick a random color from array and assign to base
    const color = baseThemeColors[Math.floor(Math.random() * 1000) % baseThemeColors.length]
    const tcolor = tinycolor(color)

    const complement = tcolor.complement()

    const jobData = await api.base.duplicate(props.base.id as string, {
      options: optionsToExclude.value,
      base: {
        fk_workspace_id:
          targetWorkspace.value && targetWorkspace.value?.id ? targetWorkspace.value.id : props.base.fk_workspace_id,
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
            await loadProjects('workspace')
            const base = bases.value.get(jobData.base_id)

            // open project after duplication
            /* if (base) {
              navigateToProject({
                workspaceId: isEeUI ? base.fk_workspace_id : undefined,
                baseId: base.id,
                type: base.type,
              })
            }
            refreshCommandPalette()
            isLoading.value = false
            dialogShow.value = false */
          } else if (data.status === JobStatus.FAILED) {
            /* message.error('Failed to duplicate project')
            await loadProjects('workspace')
            refreshCommandPalette()
            isLoading.value = false
            dialogShow.value = false */
          }
        }
      },
    )

    $e('a:base:duplicate')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    isLoading.value = false
    dialogShow.value = false
  }
}

onKeyStroke('Enter', () => {
  // should only trigger this when our modal is open
  if (dialogShow.value) {
    _duplicate()
  }
})

const isEaster = ref(false)

const dropdownOpen = ref(false)

const selectOption = (option) => {
  targetWorkspace.value = option
  dropdownOpen.value = false
}
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
      <div class="text-base text-nc-content-gray-emphasis font-bold self-center" @dblclick="isEaster = !isEaster">
        <template v-if="['pending', 'loading'].includes(status)">
          {{ $t('general.duplicate') }} {{ $t('objects.project') }} "{{ base.title }}"
        </template>

        <template v-else-if="status === 'success'">
          <div class="flex items-center gap-2">
            <GeneralIcon class="text-white w-6 h-6" icon="checkFill" />
            <div class="text-brand-500 font-semibold">
              {{ $t('general.success') }}
            </div>
          </div>
        </template>
        <template v-else-if="status === 'error'">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-6 h-6" />
            <div class="text-brand-500 font-semibold">
              {{ $t('general.success') }}
            </div>
          </div>
        </template>
      </div>

      <div class="mt-5 flex gap-3 flex-col">
        <div
          class="flex gap-3 cursor-pointer text-nc-content-gray font-medium items-center"
          @click="options.includeData = !options.includeData"
        >
          <NcSwitch :checked="options.includeData" />
          {{ $t('labels.includeRecords') }}
        </div>

        <!--        <div
          class="flex gap-3 cursor-pointer text-nc-content-gray font-medium items-center"
          @click="options.includeViews = !options.includeViews"
        >
          <NcSwitch :checked="options.includeViews" />
          {{ $t('labels.includeView') }}
        </div>

        <div
          class="flex gap-3 cursor-pointer text-nc-content-gray font-medium items-center"
          @click="options.includeHooks = !options.includeHooks"
        >
          <NcSwitch :checked="options.includeHooks" />
          {{ $t('labels.includeWebhook') }}
        </div> -->

        <div
          class="flex gap-3 cursor-pointer text-nc-content-gray font-medium items-center"
          @click="options.includeComments = !options.includeComments"
        >
          <NcSwitch :checked="options.includeComments" />
          {{ $t('labels.includeComments') }}
        </div>
      </div>

      <div class="mt-5 text-nc-content-gray-subtle2 font-medium">{{ $t('labels.baseDuplicateMessage') }}</div>

      <div v-if="isEeUI">
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

              <div class="flex-1 capitalize">
                {{ targetWorkspace.title }}
              </div>

              <div class="flex gap-2 items-center">
                <div v-if="activeWorkspace.id === targetWorkspace?.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
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
                v-model:value="targetWorkspace"
                :item-height="28"
                close-on-select
                min-items-for-search="6"
                container-class-name="w-full"
                :list="workspaceOptions"
                option-label-key="title"
              >
                <template #listHeader>
                  <div class="text-nc-content-gray-muted text-[13px] px-3 py-2.5 font-medium leading-5">
                    You can only duplicate bases into workspaces where you have creator access or above.
                  </div>

                  <NcDivider />
                </template>

                <template #listItem="{ option, isSelected }">
                  <div class="flex gap-2 w-full items-center" @click="selectOption(option)">
                    <GeneralWorkspaceIcon :workspace="option" size="small" />

                    <div class="flex-1 text-[13px] font-semibold leading-5 capitalize w-full">
                      {{ option.title }}
                    </div>

                    <div class="flex items-center gap-2">
                      <div v-if="activeWorkspace.id === option.id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                        {{ $t('labels.currentWorkspace') }}
                      </div>
                      <GeneralIcon v-if="option.id === targetWorkspace.id" class="text-brand-500 w-4 h-4" icon="ncCheck" />
                    </div>
                  </div>
                </template>
              </NcList>
            </template>
          </NcDropdown>
        </div>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
      <NcButton v-if="!isLoading" key="back" type="secondary" size="small" @click="dialogShow = false">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton
        key="submit"
        v-e="['a:base:duplicate']"
        size="small"
        :loading="isLoading"
        :disabled="isLoading"
        @click="_duplicate"
      >
        {{ $t('general.duplicate') }} {{ $t('objects.project') }}
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
.nc-list {
  .nc-list-item {
    @apply !py-1;
  }
}
</style>
