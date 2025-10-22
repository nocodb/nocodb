<script setup lang="ts">
import { IconType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible', 'created'])

const useForm = Form.useForm

const vVisible = useVModel(props, 'visible', emits)

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { createTeam: _createTeam } = workspaceStore

const { teams, activeWorkspaceId } = storeToRefs(workspaceStore)

const inputEl = ref<HTMLInputElement>()

const formState = reactive<{
  title: string
  description: string
  icon: string
  icon_type: IconType | string

  // Todo: Phase II
  badge_color?: string
}>({
  title: '',
  description: '',
  icon: '',
  icon_type: '',
  badge_color: undefined,
})

const enableDescription = ref(false)

// Todo: Enable this once we support team description
const showDescription = false

const removeDescription = () => {
  formState.description = ''
  enableDescription.value = false
}

const validators = computed(() => {
  return {
    title: [
      validateTeamName,
      {
        validator: (_: any, value: any) => {
          return new Promise((resolve, reject) => {
            if (teams.value?.some((team) => team.title?.toLowerCase() === value?.toLowerCase())) {
              return reject(new Error(t('msg.error.duplicateTeamName')))
            }

            return resolve(true)
          })
        },
      },
    ],
  }
})
const { validate, validateInfos } = useForm(formState, validators)

const creating = ref(false)

const createTeam = async () => {
  if (creating.value) return

  try {
    creating.value = true
    await validate()
    const team = await _createTeam(activeWorkspaceId.value, {
      ...formState,
      icon: formState.icon || undefined,
      icon_type: formState.icon_type || undefined,
      badge_color: formState.badge_color || undefined,
    })
    emits('created', team as TeamType)
    vVisible.value = false
  } catch (e: any) {
    console.error(e)
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    if (e.errorFields.length) return
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

const toggleDescription = () => {
  if (enableDescription.value) {
    enableDescription.value = false
  } else {
    enableDescription.value = true
    setTimeout(() => {
      inputEl.value?.focus()
    }, 100)
  }
}

watch(vVisible, (newValue) => {
  if (!newValue) {
    return
  }

  formState.title = generateUniqueTitle(`Team`, teams.value ?? [], 'title', '-', true)
  formState.icon = ''
  formState.icon_type = ''
  formState.badge_color = undefined

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
})
</script>

<template>
  <NcModal
    v-model:visible="vVisible"
    :header="$t('labels.newTeam')"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    class="!top-[25vh]"
    :mask-closable="!creating"
    wrap-class-name="nc-modal-team-create-wrapper"
  >
    <div class="py-5 flex flex-col gap-5">
      <div class="px-5 flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-gray-800">
          <GeneralIcon icon="ncBuilding" class="!text-gray-600 w-5 h-5" />
          {{ $t('labels.newTeam') }}
        </div>
      </div>

      <a-form
        layout="vertical"
        :model="formState"
        name="create-new-team-form"
        class="flex flex-col gap-5 !px-5"
        @keydown.enter="createTeam"
        @keydown.esc="vVisible = false"
      >
        <div class="flex flex-col gap-5">
          <a-form-item v-bind="validateInfos.title" class="relative nc-team-input-wrapper relative">
            <div class="relative">
              <a-input
                ref="inputEl"
                v-model:value="formState.title"
                class="nc-team-input nc-input-sm nc-input-shadow"
                hide-details
                data-testid="create-team-title-input"
                :placeholder="$t('placeholder.enterTeamName')"
              >
                <template #prefix> <div class="w-6">&nbsp;</div> </template>
              </a-input>
              <div class="absolute left-0 top-0 z-10">
                <GeneralIconSelector
                  v-model:icon="formState.icon"
                  v-model:icon-type="formState.icon_type"
                  :default-active-tab="IconType.ICON"
                  :tab-order="[IconType.ICON, IconType.EMOJI]"
                  :hidden-tabs="[IconType.IMAGE]"
                  :image-cropper-data="{}"
                >
                  <template #default="{ isOpen }">
                    <div
                      class="border-1 w-8 h-8 flex-none rounded-lg overflow-hidden transition-all duration-300 cursor-pointer"
                      :class="{
                        'border-transparent !rounded-r-none border-r-nc-border-gray-medium': !isOpen,
                        'border-primary shadow-selected': isOpen,
                      }"
                    >
                      <GeneralTeamIcon
                        :icon="formState.icon"
                        :icon-type="formState.icon_type"
                        class="!w-full !h-full !min-w-full select-none cursor-pointer !rounded-none"
                      />
                    </div>
                  </template>
                </GeneralIconSelector>
              </div>
            </div>
          </a-form-item>

          <a-form-item v-if="enableDescription" v-bind="validateInfos.description" class="!mb-0">
            <div class="flex gap-3 text-gray-800 h-7 mb-1 items-center justify-between">
              <span class="text-[13px]">
                {{ $t('labels.description') }}
              </span>
              <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
                <GeneralIcon icon="delete" class="text-gray-700 w-3.5 h-3.5" />
              </NcButton>
            </div>

            <a-textarea
              ref="inputEl"
              v-model:value="formState.description"
              class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
              hide-details
              data-testid="create-team-description-input"
              :placeholder="$t('placeholder.enterTeamDescription')"
            />
          </a-form-item>
        </div>

        <div class="flex flex-row items-center justify-between gap-x-2">
          <NcButton v-if="showDescription && !enableDescription" size="small" type="text" @click.stop="toggleDescription">
            <div class="flex !text-gray-700 items-center gap-2">
              <GeneralIcon icon="plus" class="h-4 w-4" />

              <span class="first-letter:capitalize">
                {{ $t('labels.addDescription').toLowerCase() }}
              </span>
            </div>
          </NcButton>
          <div v-else></div>
          <div class="flex gap-2 items-center">
            <NcButton type="secondary" size="small" :disabled="creating" @click="vVisible = false">
              {{ $t('general.cancel') }}
            </NcButton>

            <NcButton
              v-e="['a:team:create']"
              type="primary"
              size="small"
              :disabled="validateInfos.title?.validateStatus === 'error' || creating"
              :loading="creating"
              @click="createTeam"
            >
              {{ $t('labels.createTeam') }}
              <template #loading> {{ $t('labels.creatingTeam') }} </template>
            </NcButton>
          </div>
        </div>
      </a-form>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}

.nc-input-text-area {
  padding-block: 8px !important;
}
</style>
