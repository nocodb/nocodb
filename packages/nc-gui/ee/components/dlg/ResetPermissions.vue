<script lang="ts" setup>
import { type ColumnType, PermissionEntity } from 'nocodb-sdk'

interface Props {
  visible: boolean
  tableName: string
  tableId: string
  tableColumns?: ColumnType[]
  showCheckbox?: boolean
  options?: Array<PermissionEntity>
}

const props = withDefaults(defineProps<Props>(), {
  showCheckbox: true,
  options: () => [PermissionEntity.TABLE, PermissionEntity.FIELD],
})

const emits = defineEmits(['update:visible', 'update:permissions'])

const vVisible = useVModel(props, 'visible', emits)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const basesStore = useBases()

const { getMeta } = useMetas()

const { base } = storeToRefs(useBase())

const { permissionList } = usePermissions()

const columns = ref<ColumnType[]>([])

const isLoading = ref(true)

const optionVisibility = ref(
  props.options.reduce((acc, option) => {
    acc[option] = true
    return acc
  }, {} as Record<string, boolean>),
)

const isDeleting = ref(false)

const permissionOptions = computed(() => {
  return [
    {
      title: t('objects.permissions.resetTablePermissions'),
      description: t('objects.permissions.resetTablePermissionsDescription'),
      value: PermissionEntity.TABLE,
    },
    {
      title: t('objects.permissions.resetFieldPermissions'),
      description: t('objects.permissions.resetFieldPermissionsDescription'),
      value: PermissionEntity.FIELD,
    },
  ].filter((option) => props.options.includes(option.value))
})

const entitiesToDelete = computed(() => {
  return permissionOptions.value.filter((option) => optionVisibility.value[option.value]).map((option) => option.value)
})

const handleResetPermissions = async () => {
  if (!base.value || !entitiesToDelete.value.length) {
    vVisible.value = false
    return
  }

  isDeleting.value = true

  const columnIds = columns.value.map((column) => column.id)

  const { permissionIds, subjectIds } = permissionList.value.reduce(
    (acc, permission) => {
      // Filter out permissions that are not in the entitiesToDelete array
      if (!entitiesToDelete.value.includes(permission.entity as PermissionEntity)) {
        return acc
      }

      /**
       * Delete all field permissions of given table
       */
      if (permission.entity === PermissionEntity.FIELD && columnIds.includes(permission.entity_id)) {
        acc.permissionIds.push(permission.id!)
        acc.subjectIds.push(...(permission.subjects || []).map((subject) => subject.id))

        return acc
      }

      /**
       * Delete all table permissions of given table
       */
      if (permission.entity === PermissionEntity.TABLE && permission.entity_id === props.tableId) {
        acc.permissionIds.push(permission.id!)
        acc.subjectIds.push(...(permission.subjects || []).map((subject) => subject.id))

        return acc
      }

      return acc
    },
    {
      permissionIds: [],
      subjectIds: [],
    } as { permissionIds: string[]; subjectIds: string[] },
  )

  if (!permissionIds.length && !subjectIds.length) {
    isDeleting.value = false
    vVisible.value = false
    return
  }

  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id as string,
      base.value.id as string,
      {
        operation: 'bulkDropPermissions',
      },
      {
        permissionIds,
        subjectIds,
      },
    )

    $e('a:permissions:reset')

    await basesStore.loadProject(base.value.id!, true)
  } catch (error: any) {
    console.error(error)
    message.error(await extractSdkResponseErrorMsg(error))
  } finally {
    isDeleting.value = false
    vVisible.value = false
  }
}

const onTogglePermission = (permission: 'table' | 'field') => {
  optionVisibility.value[permission] = !optionVisibility.value[permission]
}

const title = computed(() => {
  if (permissionOptions.value.length === 1) {
    return permissionOptions.value[0]!.title
  }

  return t('objects.permissions.confirmRevertPermissionsToDefault', { tableName: props.tableName })
})

const content = computed(() => {
  if (permissionOptions.value.length === 1) {
    return permissionOptions.value[0]!.description
  }
})

// Load table metadata
const loadTableMeta = async () => {
  if (!props.tableId) return

  // No need to load table meta if it's passed as a prop
  if (props.tableColumns) {
    columns.value = props.tableColumns
    isLoading.value = false
    return
  }

  try {
    const tableMetaData = await getMeta(props.tableId)
    columns.value = tableMetaData?.columns ?? []
  } catch (error: any) {
    console.error('Failed to load table metadata:', error)
    message.error(await extractSdkResponseErrorMsg(error))
  } finally {
    isLoading.value = false
  }
}

const onCancel = () => {
  vVisible.value = false
}

// Watch for table ID changes
watch(
  () => props.tableId,
  (newTableId) => {
    if (!newTableId) {
      isLoading.value = false
      return
    }

    loadTableMeta()
  },
  { immediate: true },
)
</script>

<template>
  <NcModalConfirm
    v-model:visible="vVisible"
    :title="title"
    :content="content"
    ok-text="Confirm Revert"
    :show-icon="false"
    mask-closable
    :ok-props="{ loading: isDeleting, disabled: isLoading || !entitiesToDelete.length }"
    @cancel="onCancel"
    @ok="handleResetPermissions"
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
