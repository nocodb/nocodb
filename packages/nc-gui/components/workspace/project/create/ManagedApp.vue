<script setup lang="ts">
import { type FormDefinition, BaseVersion, FormBuilderValidatorType } from 'nocodb-sdk'
import { FORM_BUILDER_NON_CATEGORIZED, FormBuilderInputType } from '#imports'

const props = defineProps<{
  visible: boolean
  baseId?: string
  title?: string
  subTitle?: string
  alertDescription?: string
  submitButtonText?: string
}>()

const emit = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emit)

const { title, subTitle, alertDescription, submitButtonText } = toRefs(props)

const { $api } = useNuxtApp()

const { t } = useI18n()

const { navigateToProject } = useGlobal()

const initialSanboxFormState = ref<Record<string, any>>({
  title: '',
  description: '',
  category: '',
  visibility: 'private',
  startFrom: props.baseId ? 'existing' : 'new',
  baseId: props.baseId,
})

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const baseStore = useBase()

const { base } = storeToRefs(baseStore)

const createManagedApp = async (formState: Record<string, any>) => {
  try {
    const response = await $api.internal.postOperation(
      activeWorkspaceId.value as string,
      formState.baseId || NO_SCOPE,
      {
        operation: 'managedAppCreate',
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

    message.success(t('msg.success.managedAppCreated'))
    visible.value = false

    // Update the base with the managed_app_id from response
    if (response && response.managed_app_id && formState.baseId) {
      const currentBase = basesStore.bases.get(formState.baseId as string)
      if (currentBase) {
        ;(currentBase as any).managed_app_id = response.managed_app_id
      }
    }

    // Reload base to ensure all managed app data is loaded
    if (formState.baseId) {
      await basesStore.loadProject(formState.baseId, true)
    } else {
      await basesStore.loadProjects()
    }

    if (!props.baseId && (response?.base_id || formState.baseId) && base.value?.id !== (response?.base_id || formState.baseId)) {
      navigateToProject({
        baseId: response?.base_id || formState.baseId,
        workspaceId: activeWorkspaceId.value as string,
      })
    } else if (base.value?.id && base.value.id === formState.baseId) {
      baseStore.loadManagedApp()
      baseStore.loadCurrentVersion()
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const { formState, isLoading, submit } = useProvideFormBuilderHelper({
  formSchema: [
    {
      type: FormBuilderInputType.Input,
      label: t('labels.managedAppTitle'),
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
      label: t('labels.managedAppDescription'),
      span: 24,
      model: 'description',
      placeholder: "Describe your application's capabilities",
      category: FORM_BUILDER_NON_CATEGORIZED,
    },
    ...(!props.baseId
      ? ([
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
            filterOption: (base) => base && base.version === BaseVersion.V3 && !base.managed_app_id,
            helpText: 'Only V3 bases can be published as managed apps',
            showHintAsTooltip: true,
          },
        ] as FormDefinition)
      : []),

    {
      type: FormBuilderInputType.Input,
      label: t('labels.managedAppCategory'),
      span: 12,
      model: 'category',
      placeholder: 'e.g., CRM, HR',
      category: FORM_BUILDER_NON_CATEGORIZED,
    },
    {
      type: FormBuilderInputType.Select,
      label: t('labels.managedAppVisibility'),
      span: 12,
      model: 'visibility',
      category: FORM_BUILDER_NON_CATEGORIZED,
      options: [
        // { label: 'Public', value: 'public', icon: 'eye' },
        { label: 'Private', value: 'private', icon: 'lock' },
        { label: 'Unlisted', value: 'unlisted', icon: 'ncEyeOff' },
      ],
      defaultValue: 'private',
    },
  ],
  onSubmit: async () => {
    if (!props.baseId && formState.value.startFrom === 'new' && formState.value.baseId) {
      formState.value.baseId = ''
    }

    if (props.baseId) {
      formState.value.baseId = props.baseId
    }

    formState.value.title = formState.value.title.trim()

    return await createManagedApp(formState.value)
  },
  initialState: initialSanboxFormState,
})
</script>

<template>
  <div class="flex flex-col h-full">
    <DlgManagedAppHeader
      v-model:visible="visible"
      :title="title || 'Create Managed App'"
      :subTitle="subTitle || $t('labels.publishToAppStore')"
    />

    <div class="flex-1 p-6 nc-scrollbar-thin">
      <NcFormBuilder>
        <template #header>
          <NcAlert
            type="info"
            align="top"
            :description="
              alertDescription ||
              'Create managed application that can be published to the App Store. You\'ll be able to manage versions and push updates to all installations.'
            "
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
        {{ submitButtonText || 'Create managed app' }}
      </NcButton>
    </div>
  </div>
</template>
