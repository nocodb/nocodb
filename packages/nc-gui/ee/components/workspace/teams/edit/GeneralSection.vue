<script lang="ts" setup>
interface Props {
  team: TeamType
}

const props = withDefaults(defineProps<Props>(), {})

const useForm = Form.useForm

const { team } = toRefs(props)

const inputEl = ref<HTMLInputElement>()

const formState = reactive({
  title: '',
  description: '',
  meta: {},
})

const validators = computed(() => {
  return {
    title: [validateTeamName],
  }
})
const { validate, validateInfos } = useForm(formState, validators)

const updating = ref(false)

const updateTeam = async () => {
  try {
    updating.value = true
    await validate()
    // Todo: update team
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
  formState.meta = parseProp(team.value.meta)

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
})
</script>

<template>
  <div class="nc-modal-teams-edit-content-section mt-6">
    <div class="nc-modal-teams-edit-content-section-title text-bodyBold">{{ $t('general.general') }}</div>
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
        <a-input
          ref="inputEl"
          v-model:value="formState.title"
          class="nc-team-input nc-input-sm nc-input-shadow"
          hide-details
          data-testid="create-team-title-input"
          :placeholder="$t('placeholder.enterTeamName')"
          @input="updateTeamWithDebounce"
        />
      </a-form-item>
      <a-form-item class="!mb-0">
        <template #label>
          {{ $t('labels.description') }}
        </template>

        <a-textarea
          ref="inputEl"
          v-model:value="formState.description"
          class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
          hide-details
          data-testid="create-team-description-input"
          :placeholder="$t('placeholder.enterTeamDescription')"
          @input="updateTeamWithDebounce"
        />
      </a-form-item>
    </a-form>
  </div>
</template>
