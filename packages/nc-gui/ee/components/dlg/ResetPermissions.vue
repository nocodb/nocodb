<script lang="ts" setup>
import { PermissionEntity } from 'nocodb-sdk'

interface Props {
  visible: boolean
  tableName: string
  tableId?: string
  showCheckbox?: boolean
  options?: Array<PermissionEntity>
}

const props = withDefaults(defineProps<Props>(), {
  showCheckbox: true,
  options: () => [PermissionEntity.TABLE, PermissionEntity.FIELD],
})

const emits = defineEmits(['update:visible', 'update:permissions'])

const vVisible = useVModel(props, 'visible', emits)

const { $api } = useNuxtApp()

const basesStore = useBases()

const { base } = storeToRefs(useBase())

const optionVisibility = ref(
  props.options.reduce((acc, option) => {
    acc[option] = true
    return acc
  }, {} as Record<string, boolean>),
)

const isDeleting = ref(false)

const onCancel = () => {
  vVisible.value = false
}

const onOk = async () => {
  if (!base.value) return

  isDeleting.value = true

  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id as string,
      base.value.id as string,
      {
        operation: 'dropAllPermissions',
      },
      {
        entities: props.options.filter((option) => optionVisibility.value[option]),
        baseId: base.value.id,
        modelId: props.tableId,
      },
    )

    await basesStore.loadProject(base.value.id!, true)
  } catch (error: any) {
    console.error(error)
    message.error(await extractSdkResponseErrorMsg(error))
  } finally {
    isDeleting.value = false
    vVisible.value = false
  }
}

const permissionOptions = computed(() => {
  return [
    {
      title: 'Reset table permissions',
      description: 'Only Editors & up can create and delete records in a table',
      value: PermissionEntity.TABLE,
    },
    {
      title: 'Reset field permissions',
      description: 'Edit access will be set to Editors & up.',
      value: PermissionEntity.FIELD,
    },
  ].filter((option) => props.options.includes(option.value))
})

const onTogglePermission = (permission: 'table' | 'field') => {
  optionVisibility.value[permission] = !optionVisibility.value[permission]
}

const title = computed(() => {
  if (permissionOptions.value.length === 1) {
    return permissionOptions.value[0]!.title
  }

  return `Confirm revert permissions to default for table - "${props.tableName}"`
})

const content = computed(() => {
  if (permissionOptions.value.length === 1) {
    return permissionOptions.value[0]!.description
  }
})
</script>

<template>
  <NcModalConfirm
    v-model:visible="vVisible"
    :title="title"
    :content="content"
    ok-text="Confirm Revert"
    :show-icon="false"
    mask-closable
    :ok-props="{ loading: isDeleting }"
    @cancel="onCancel"
    @ok="onOk"
  >
    <template v-if="!content" #extraContent>
      <div class="flex flex-col gap-5 text-caption text-nc-content-gray">
        <div v-for="option in permissionOptions" :key="option.value" class="flex items-start gap-3">
          <div class="flex items-center h-5">
            <NcCheckbox
              v-if="showCheckbox"
              :checked="optionVisibility[option.value]"
              @change="onTogglePermission(option.value)"
            />
          </div>

          <div class="flex flex-col gap-2">
            <div class="font-semibold">{{ option.title }}</div>
            <div class="text-nc-content-gray-subtle">{{ option.description }}</div>
          </div>
        </div>
      </div>
    </template>
  </NcModalConfirm>
</template>
