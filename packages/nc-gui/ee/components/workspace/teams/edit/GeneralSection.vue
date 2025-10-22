<script lang="ts" setup>
import { IconType } from 'nocodb-sdk'

interface Props {
  team: TeamType
  readOnly: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const useForm = Form.useForm

const { team, readOnly } = toRefs(props)

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { teams, activeWorkspaceId } = storeToRefs(workspaceStore)

// Todo: Enable this once we support team description
const showDescription = false

const inputEl = ref<HTMLInputElement>()

const formState = reactive<{
  title: string
  description: string
  icon: string
  icon_type: IconType | string

  // Todo: Phase II
  badge_color: string
}>({
  title: '',
  description: '',
  icon: '',
  icon_type: '',
  badge_color: undefined,
})

const validators = computed(() => {
  return {
    title: [
      validateTeamName,
      {
        validator: (_: any, value: any) => {
          return new Promise((resolve, reject) => {
            if (teams.value?.some((t) => t.id !== team.value.id && t.title?.toLowerCase() === value?.toLowerCase())) {
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

const updating = ref(false)

const updateTeam = async (isIconUpdate = false) => {
  if (readOnly.value) return

  if (isIconUpdate && team.value?.icon === formState?.icon) return

  if (!isIconUpdate && team.value.title?.trim() === formState.title?.trim()) return

  try {
    updating.value = true
    if (!isIconUpdate) {
      await validate()
    }

    await workspaceStore.updateTeam(
      activeWorkspaceId.value!,
      team.value.id,
      isIconUpdate
        ? {
            icon: formState?.icon,
            icon_type: formState?.icon_type,
            // badge_color: formState?.badge_color,
          }
        : {
            title: formState.title,
          },
    )
  } catch (e: any) {
    console.error(e)
  } finally {
    updating.value = false
  }
}

const updateTeamWithDebounce = useDebounceFn(
  async () => {
    await updateTeam()
  },
  250,
  { maxWait: 3000 },
)

onMounted(() => {
  formState.title = team.value.title
  formState.description = team.value.description ?? ''
  formState.badge_color = team.value.badge_color ?? undefined
  formState.icon = team.value.icon ?? ''
  formState.icon_type = team.value.icon_type ?? ''

  if (readOnly.value) return

  nextTick(() => {
    inputEl.value?.focus()
  })
})
</script>

<template>
  <div class="nc-modal-teams-edit-content-section mt-6">
    <div v-if="showDescription" class="nc-modal-teams-edit-content-section-title text-bodyBold">{{ $t('general.general') }}</div>
    <a-form
      layout="vertical"
      :model="formState"
      name="create-new-team-form"
      class="flex flex-col gap-4"
      @keydown.enter="updateTeam"
    >
      <a-form-item v-bind="validateInfos.title" class="relative nc-team-input-wrapper relative !mb-0">
        <template #label>
          {{ $t('general.name') }}
        </template>

        <div class="relative">
          <a-input
            ref="inputEl"
            v-model:value="formState.title"
            class="nc-team-input nc-input-sm nc-input-shadow !pl-38"
            hide-details
            data-testid="create-team-title-input"
            :placeholder="$t('placeholder.enterTeamName')"
            :disabled="readOnly"
            @input="updateTeamWithDebounce"
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
              :disabled="readOnly"
              @submit="() => updateTeam(true)"
            >
              <template #default="{ isOpen }">
                <div
                  class="border-1 w-8 h-8 flex-none rounded-lg overflow-hidden transition-all duration-300"
                  :class="{
                    'border-transparent !rounded-r-none border-r-nc-border-gray-medium': !isOpen,
                    'border-primary shadow-selected': isOpen,
                    'cursor-not-allowed': readOnly,
                    'cursor-pointer': !readOnly,
                  }"
                >
                  <GeneralTeamIcon
                    :icon="formState.icon"
                    :icon-type="formState.icon_type"
                    class="!w-full !h-full !min-w-full select-none cursor-pointer !rounded-none"
                    :class="readOnly ? 'cursor-not-allowed' : 'cursor-pointer'"
                  />
                </div>
              </template>
            </GeneralIconSelector>
          </div>
        </div>
      </a-form-item>
      <a-form-item v-if="showDescription" class="!mb-0">
        <template #label>
          {{ $t('labels.description') }}
        </template>

        <a-textarea
          v-model:value="formState.description"
          class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] !min-h-[80px]"
          hide-details
          data-testid="create-team-description-input"
          :placeholder="$t('placeholder.enterTeamDescription')"
          :disabled="readOnly"
          @input="updateTeamWithDebounce"
        />
      </a-form-item>
    </a-form>
  </div>
</template>
