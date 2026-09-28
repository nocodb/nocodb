<script setup lang="ts">
import type { EnvironmentType } from 'nocodb-sdk'
import { DEFAULT_ENV_COLOR, ENV_COLORS } from './constants'

interface Props {
  modelValue: boolean
  environment?: EnvironmentType
  // Persistence is delegated to the caller — the modal is just the form. Workspace
  // callers pass a handler that hits the store; the org-admin panel passes one that
  // hits the v3 org routes. Same form drives both scopes, no persistence coupling.
  saveHandler: (body: { title: string; description: string; color: string }, environment?: EnvironmentType) => Promise<void>
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'saved'])

const vVisible = useVModel(props, 'modelValue', emit)

const isEdit = computed(() => !!props.environment?.id)

const inputRef = ref()

const descriptionRef = ref()

// Description is opt-in (hidden behind a button) — like the table/view create dialogs.
const enableDescription = ref(false)

const form = reactive({
  title: '',
  description: '',
  color: DEFAULT_ENV_COLOR,
})

const isSaving = ref(false)

const isValid = computed(() => !!form.title.trim())

function toggleDescription() {
  enableDescription.value = true
  nextTick(() => descriptionRef.value?.focus())
}

function removeDescription() {
  enableDescription.value = false
  form.description = ''
}

watch(vVisible, (open) => {
  if (!open) return
  form.title = props.environment?.title ?? ''
  form.description = props.environment?.description ?? ''
  form.color = props.environment?.color ?? DEFAULT_ENV_COLOR
  // Show the description upfront only when editing an env that already has one.
  enableDescription.value = !!form.description
  nextTick(() => inputRef.value?.focus())
})

async function onSave() {
  if (!isValid.value || isSaving.value) return

  isSaving.value = true
  try {
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      color: form.color,
    }

    await props.saveHandler(body, props.environment)

    emit('saved')
    vVisible.value = false
  } catch {
    // the caller's save handler surfaces the error toast
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <NcModal
    v-model:visible="vVisible"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    class="nc-environment-edit-modal !top-[25vh]"
    @keydown.esc="vVisible = false"
  >
    <div class="py-5 flex flex-col gap-5">
      <div class="px-5 flex flex-col gap-1">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-nc-content-gray">
          <GeneralIcon icon="ncSlidersHorizontal" class="!text-nc-content-gray-subtle2 w-5 h-5" />
          {{ isEdit ? $t('title.editEnvironment') : $t('title.newEnvironment') }}
        </div>
        <div class="text-nc-content-gray-subtle2 text-bodySm">
          {{ $t('msg.info.environmentAvailableToAll') }}
        </div>
      </div>

      <div class="px-5 flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <span class="text-nc-content-gray-subtle2 text-bodySm">{{ $t('general.name') }}</span>
          <a-input
            ref="inputRef"
            v-model:value="form.title"
            class="nc-input-sm nc-input-shadow nc-environment-name-input"
            hide-details
            data-testid="nc-environment-name-input"
            :placeholder="$t('placeholder.environmentName')"
            @keydown.enter="onSave"
          />
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-nc-content-gray-subtle2 text-bodySm">{{ $t('general.color') }}</span>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="c in ENV_COLORS"
              :key="c"
              type="button"
              class="nc-environment-color-swatch w-7 h-7 rounded-lg transition-transform"
              :class="form.color === c ? 'ring-2 ring-offset-2 ring-nc-border-brand' : 'hover:scale-110'"
              :style="{ backgroundColor: c }"
              :data-testid="`nc-environment-color-${c}`"
              @click="form.color = c"
            />
          </div>
        </div>

        <div v-if="enableDescription" class="flex flex-col gap-2">
          <div class="flex items-center justify-between h-6">
            <span class="text-nc-content-gray-subtle2 text-bodySm">{{ $t('general.description') }}</span>
            <NcButton type="text" size="xsmall" class="!h-6 !w-5" @click="removeDescription">
              <GeneralIcon icon="delete" class="text-nc-content-gray-subtle w-3.5 h-3.5" />
            </NcButton>
          </div>
          <a-textarea
            ref="descriptionRef"
            v-model:value="form.description"
            class="nc-input-sm nc-input-shadow nc-environment-description-input"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            data-testid="nc-environment-description-input"
            :placeholder="$t('placeholder.environmentDescription')"
          />
        </div>
      </div>

      <div class="px-5 flex flex-row items-center justify-between gap-x-2">
        <NcButton
          v-if="!enableDescription"
          type="text"
          size="small"
          data-testid="nc-environment-add-description-btn"
          @click.stop="toggleDescription"
        >
          <div class="flex !text-nc-content-gray-subtle items-center gap-2">
            <GeneralIcon icon="plus" class="h-4 w-4" />
            <span class="first-letter:capitalize">{{ $t('labels.addDescription').toLowerCase() }}</span>
          </div>
        </NcButton>
        <div v-else />

        <div class="flex items-center gap-2">
          <NcButton type="secondary" size="small" @click="vVisible = false">
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton
            type="primary"
            size="small"
            :disabled="!isValid"
            :loading="isSaving"
            data-testid="nc-environment-save-btn"
            @click="onSave"
          >
            {{ isEdit ? $t('general.saveChanges') : $t('general.create') }}
          </NcButton>
        </div>
      </div>
    </div>
  </NcModal>
</template>
