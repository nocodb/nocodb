<script setup lang="ts">
import { FormBuilderValidatorType, type CustomFormBuilderValidator } from 'nocodb-sdk'
import { FORM_BUILDER_NON_CATEGORIZED, FormBuilderInputType } from '#imports'

const props = defineProps<{
  visible: boolean
  baseId?: string
}>()

const emit = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emit)

const { $api } = useNuxtApp()

const { t } = useI18n()

const { navigateToProject } = useGlobal()

const initialSanboxFormState = ref<Record<string, any>>({
  title: '',
  description: '',
  category: '',
  visibility: 'private',
  startFrom: 'new',
  baseId: undefined,
})

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const createManagedApp = async (formState: Record<string, any>) => {
  try {
    const response = await $api.internal.postOperation(
      activeWorkspaceId.value as string,
      formState.baseId || NO_SCOPE,
      {
        operation: 'sandboxCreate',
      } as any,
      {
        title: formState.title,
        description: formState.description,
        category: formState.category,
        visibility: formState.visibility,
        ...(!formState.baseId
          ? {
              basePayload: {
                title: formState.title,
                default_role: '' as NcProject['default_role'],
                meta: JSON.stringify({
                  iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
                }),
              },
            }
          : {}),
      },
    )

    message.success(t('msg.success.sandboxCreated'))
    visible.value = false

    // Update the base with the sandbox_id from response
    if (response && response.sandbox_id && formState.baseId) {
      const currentBase = basesStore.bases.get(formState.baseId as string)
      if (currentBase) {
        ;(currentBase as any).sandbox_id = response.sandbox_id
      }
    }

    // Reload base to ensure all sandbox data is loaded
    if (formState.baseId) {
      await basesStore.loadProject(formState.baseId, true)
    } else {
      await basesStore.loadProjects()
    }

    if (response?.base_id || formState.baseId) {
      navigateToProject({
        baseId: response?.base_id || formState.baseId,
        workspaceId: activeWorkspaceId.value as string,
      })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const { formState, isLoading, submit } = useProvideFormBuilderHelper({
  formSchema: [
    {
      type: FormBuilderInputType.Input,
      label: t('labels.sandboxTitle'),
      span: 24,
      model: 'title',
      placeholder: 'Enter a descriptive title',
      category: FORM_BUILDER_NON_CATEGORIZED,
      validators: [
        {
          type: FormBuilderValidatorType.Required,
          message: t('labels.titleRequired'),
        },
        {
          type: FormBuilderValidatorType.Custom,
          validator: baseTitleValidator('App').validator,
        },
      ],
      required: true,
    },
    {
      type: FormBuilderInputType.Textarea,
      label: t('labels.sandboxDescription'),
      span: 24,
      model: 'description',
      placeholder: "Describe your application's capabilities",
      category: FORM_BUILDER_NON_CATEGORIZED,
    },
    {
      type: FormBuilderInputType.Select,
      label: 'Start from',
      span: 12,
      model: 'startFrom',
      category: FORM_BUILDER_NON_CATEGORIZED,
      options: [
        { label: 'New', value: 'new', icon: 'plus' },
        { label: 'Existing Base', value: 'existing', icon: 'copy' },
      ],
      defaultValue: 'new',
    },
    {
      type: FormBuilderInputType.Space,
      span: 12,
      category: FORM_BUILDER_NON_CATEGORIZED,
      condition: {
        model: 'startFrom',
        equal: 'new',
      },
    },
    {
      type: FormBuilderInputType.SelectBase,
      label: 'Select base',
      span: 12,
      model: 'baseId',
      category: FORM_BUILDER_NON_CATEGORIZED,
      condition: {
        model: 'startFrom',
        equal: 'existing',
      },
      defaultValue: undefined,
    },
    {
      type: FormBuilderInputType.Input,
      label: t('labels.sandboxCategory'),
      span: 12,
      model: 'category',
      placeholder: 'e.g., CRM, HR',
      category: FORM_BUILDER_NON_CATEGORIZED,
    },
    {
      type: FormBuilderInputType.Select,
      label: t('labels.sandboxVisibility'),
      span: 12,
      model: 'visibility',
      category: FORM_BUILDER_NON_CATEGORIZED,
      options: [
        { label: 'Public', value: 'public', icon: 'eye' },
        { label: 'Private', value: 'private', icon: 'lock' },
        { label: 'Unlisted', value: 'unlisted', icon: 'ncEyeOff' },
      ],
      defaultValue: 'private',
    },
  ],
  onSubmit: async () => {
    if (formState.value.startFrom === 'new' && formState.value.baseId) {
      formState.value.baseId = ''
    }

    formState.value.title = formState.value.title.trim()

    return await createManagedApp(formState.value)
  },
  initialState: initialSanboxFormState,
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-4 w-full flex items-center gap-3 border-b border-nc-border-gray-medium">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
        <GeneralIcon icon="ncBox" class="w-5 h-5 text-white" />
      </div>
      <div class="flex-1">
        <div class="font-semibold text-lg text-nc-content-gray-emphasis">Create Managed App</div>
        <div class="text-xs text-nc-content-gray-subtle2">{{ $t('labels.publishToAppStore') }}</div>
      </div>

      <NcButton size="small" type="text" class="self-start" @click="visible = false">
        <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
      </NcButton>
    </div>

    <div class="flex-1 p-6 nc-scrollbar-thin">
      <NcFormBuilder>
        <template #header>
          <NcAlert
            type="info"
            align="top"
            description="Create managed application that can be published to the App Store. You'll be able to manage versions and push updates to all installations."
            class="!p-3 !items-start bg-nc-bg-blue-light border-1 !border-nc-blue-200 rounded-lg p-3 mb-4"
          >
            <template #icon>
              <GeneralIcon icon="info" class="w-4 h-4 mt-0.5 text-nc-content-blue-dark flex-none" />
            </template>
          </NcAlert>
        </template>
      </NcFormBuilder>
    </div>

    <div class="flex justify-end gap-2 px-6 py-3 border-t border-nc-border-gray-medium">
      <NcButton size="small" type="secondary" :disabled="isLoading" @click="visible = false">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton size="small" type="primary" :loading="isLoading" @click="submit">
        <template #icon>
          <GeneralIcon icon="ncBox" />
        </template>
        Convert to sandbox
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss">
.nc-modal-convert-to-sandbox {
  .nc-modal {
    max-height: min(90vh, 540px) !important;
    height: min(90vh, 540px) !important;
  }
}
</style>
