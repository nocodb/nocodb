<script setup lang="ts">
import dayjs from 'dayjs'
import type { WorkflowRunAs, WorkflowRunAsType } from 'nocodb-sdk'
import { RUN_AS_ALLOWED_ROLES, extractProjectRolePower } from 'nocodb-sdk'

const { updateWorkflowData, debouncedWorkflowUpdate, isWorkflowEditAllowed } = useWorkflowOrThrow()

const { workflow } = useWorkflowOrThrow()

const { $e } = useNuxtApp()

const { user } = useGlobal()

const { baseRoles } = useRoles()

const workflowStore = useWorkflowStore()

const { updateWorkflow } = workflowStore

const baseStore = useBases()

const { activeProjectId } = storeToRefs(baseStore)

const { getBaseUsers } = baseStore

const baseUsers = ref<any[]>([])

async function loadBaseUsers() {
  if (!activeProjectId.value) return
  const { users: fetchedUsers } = await getBaseUsers({ baseId: activeProjectId.value, force: true })
  baseUsers.value = fetchedUsers || []
}

onMounted(loadBaseUsers)

const isTitleInEditMode = ref(false)

const isDescriptionInEditMode = ref(false)

const titleInputRef = ref()

const descriptionInputRef = ref()

const localInput = reactive({
  title: workflow.value?.title || '',
  description: workflow.value?.description || '',
})

const workflowTitle = computed({
  get() {
    return localInput.title
  },
  set(value) {
    localInput.title = value
    updateWorkflowData({ title: value })
    debouncedWorkflowUpdate()
  },
})

const workflowDescription = computed({
  get() {
    return localInput.description
  },
  set(value) {
    localInput.description = value
    updateWorkflowData({ description: value })
    debouncedWorkflowUpdate()
  },
})

// --- Run As ---

const currentRunAs = computed<WorkflowRunAs>(() => {
  const meta = parseProp(workflow.value?.meta)
  return meta?.run_as || { type: 'service_account' }
})

// Encode run_as into a single string value for the select dropdown
const runAsSelectValue = computed(() => {
  const ra = currentRunAs.value
  if (ra.type === 'role' && ra.value) return `role:${ra.value}`
  if (ra.type === 'user' && ra.value) return `user:${ra.value}`
  return 'service_account'
})

const currentUserPower = computed(() => {
  return extractProjectRolePower({ base_roles: baseRoles.value })
})

const runAsOptions = computed(() => {
  const options: Array<{ value: string; label: string; group: string; role?: string; disabled?: boolean }> = []

  options.push({
    value: 'service_account',
    label: 'Service Account',
    group: 'Default',
  })

  for (const role of RUN_AS_ALLOWED_ROLES) {
    const rolePower = extractProjectRolePower({ base_roles: { [role]: true } })
    if (rolePower <= currentUserPower.value) {
      options.push({
        value: `role:${role}`,
        label: role.charAt(0).toUpperCase() + role.slice(1),
        group: 'Role',
        role,
      })
    }
  }

  for (const u of baseUsers.value) {
    const userBaseRoles = u.base_roles || (u.roles ? { [u.roles]: true } : {})
    const userPower = extractProjectRolePower({ base_roles: userBaseRoles })
    const isSelf = u.id === user.value?.id
    const isDisabled = !isSelf && userPower >= currentUserPower.value
    const activeRole = Object.keys(userBaseRoles).find((r) => userBaseRoles[r]) || u.roles

    options.push({
      value: `user:${u.id}`,
      label: u.email || u.display_name || 'User',
      group: 'User',
      role: activeRole,
      disabled: isDisabled,
    })
  }

  return options
})

function getCurrentRunAsPower(): number {
  const ra = currentRunAs.value
  if (ra.type === 'role' && ra.value) {
    return extractProjectRolePower({ base_roles: { [ra.value]: true } })
  }
  if (ra.type === 'user' && ra.value) {
    const u = baseUsers.value.find((bu) => bu.id === ra.value)
    if (u) {
      const roles = u.base_roles || (u.roles ? { [u.roles]: true } : {})
      return extractProjectRolePower({ base_roles: roles })
    }
  }
  return -1
}

const showRunAsWarning = ref(false)
const pendingRunAsValue = ref<string | null>(null)

function handleRunAsChange(selectValue: string) {
  if (!workflow.value?.id || !activeProjectId.value) return

  // If current run_as has higher privilege than the user, warn before changing
  const currentPower = getCurrentRunAsPower()
  if (currentPower >= currentUserPower.value) {
    pendingRunAsValue.value = selectValue
    showRunAsWarning.value = true
    return
  }

  applyRunAsChange(selectValue)
}

function onConfirmRunAsChange() {
  if (pendingRunAsValue.value) {
    applyRunAsChange(pendingRunAsValue.value)
  }
  showRunAsWarning.value = false
  pendingRunAsValue.value = null
}

function onCancelRunAsChange() {
  showRunAsWarning.value = false
  pendingRunAsValue.value = null
}

async function applyRunAsChange(selectValue: string) {
  if (!workflow.value?.id || !activeProjectId.value) return

  let runAs: WorkflowRunAs

  if (selectValue.startsWith('role:')) {
    const role = selectValue.replace('role:', '')
    runAs = { type: 'role' as WorkflowRunAsType, value: role }
  } else if (selectValue.startsWith('user:')) {
    const userId = selectValue.replace('user:', '')
    const selectedUser = baseUsers.value.find((u) => u.id === userId)
    runAs = {
      type: 'user' as WorkflowRunAsType,
      value: userId,
      display_label: selectedUser?.email || user.value?.email,
    }
  } else {
    runAs = { type: 'service_account' as WorkflowRunAsType }
  }

  const previousMeta = parseProp(workflow.value.meta)

  const meta = {
    ...previousMeta,
    run_as: runAs,
  }

  workflow.value.meta = meta

  const result = await updateWorkflow(activeProjectId.value, workflow.value.id, { meta })

  if (!result) {
    // Revert local state on failure
    workflow.value.meta = previousMeta
    return
  }

  $e('a:workflow:run-as:update', {
    workflow_id: workflow.value.id,
    run_as_type: runAs.type,
  })
}

function enableTitleEditMode() {
  if (!isWorkflowEditAllowed.value) return
  isTitleInEditMode.value = true
  nextTick(() => {
    titleInputRef.value.focus()
  })
}

function enableDescriptionEditMode() {
  if (!isWorkflowEditAllowed.value) return
  isDescriptionInEditMode.value = true
  nextTick(() => {
    descriptionInputRef.value.focus()
  })
}

function handleTitleBlur() {
  isTitleInEditMode.value = false
  $e('a:workflow:title:update', {
    workflow_id: workflow.value?.id,
  })
}

function handleDescriptionBlur() {
  isDescriptionInEditMode.value = false
  $e('a:workflow:description:update', {
    workflow_id: workflow.value?.id,
  })
}

watch(
  () => workflow.value?.description,
  () => {
    if (isDescriptionInEditMode.value) return
    if (workflow.value?.description !== localInput.description) {
      localInput.description = workflow.value?.description || ''
    }
  },
)
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 pt-4">
      <div class="flex gap-2 items-center">
        <LazyGeneralEmojiPicker
          :key="workflow?.meta?.icon"
          :readonly="!isWorkflowEditAllowed"
          :clearable="true"
          :emoji="workflow?.meta?.icon"
          class="nc-workflow-icon"
          size="large"
        >
          <template #default="{ isOpen }">
            <NcTooltip class="flex" placement="topLeft" hide-on-click :disabled="isOpen">
              <template #title>
                {{ $t('general.changeIcon') }}
              </template>

              <GeneralIcon class="w-5 h-5 text-nc-content-gray-subtle" icon="ncAutomation" />
            </NcTooltip>
          </template>
        </LazyGeneralEmojiPicker>

        <div v-if="!isTitleInEditMode" class="text-subHeading2 truncate" @click="enableTitleEditMode">
          {{ workflow.title }}
        </div>
        <div v-else>
          <a-input
            ref="titleInputRef"
            v-model:value="workflowTitle"
            class="!rounded-lg text-subHeading2 nc-input !w-74"
            @blur="handleTitleBlur"
            @keydown.enter="handleTitleBlur"
            @keydown.esc="handleTitleBlur"
          />
        </div>
      </div>

      <div class="mt-2">
        <div
          v-if="!isDescriptionInEditMode"
          class="text-body text-nc-content-gray-subtle line-clamp-3 w-85 px-1"
          @click="enableDescriptionEditMode"
        >
          <span v-if="!workflowDescription && isWorkflowEditAllowed" class="text-nc-content-gray-muted">
            {{ $t('labels.addDescription') }}
          </span>
          <template v-else>
            {{ workflowDescription }}
          </template>
        </div>
        <div v-else>
          <a-textarea
            ref="descriptionInputRef"
            v-model:value="workflowDescription"
            class="!rounded-lg text-body nc-input"
            :auto-size="{ minRows: 2, maxRows: 6 }"
            @keydown.enter="handleDescriptionBlur"
            @blur="handleDescriptionBlur"
            @keydown.esc="handleDescriptionBlur"
          />
        </div>
      </div>

      <NcDivider class="!my-6" />

      <!-- Run As -->
      <div class="flex flex-col gap-2 mb-4">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">Run As</div>
        <p class="text-xs text-nc-content-gray-muted">Choose the identity context for data operations when this workflow runs.</p>
        <NcSelect
          :value="runAsSelectValue"
          :disabled="!isWorkflowEditAllowed"
          class="!rounded-lg w-full"
          @change="handleRunAsChange"
        >
          <template v-for="group in ['Default', 'Role', 'User']" :key="group">
            <a-select-opt-group v-if="runAsOptions.some((o) => o.group === group)" :label="group">
              <a-select-option
                v-for="option in runAsOptions.filter((o) => o.group === group)"
                :key="option.value"
                :value="option.value"
                :disabled="option.disabled"
              >
                <div class="flex justify-between items-center" :class="{ 'opacity-40': option.disabled }">
                  <div class="flex items-center gap-2 min-w-0">
                    <RolesBadge
                      v-if="option.role && option.group === 'Role'"
                      :border="false"
                      :role="option.role"
                      icon-only
                      nc-badge-class="!px-1"
                    />
                    <GeneralIcon
                      v-else-if="option.group === 'User'"
                      class="w-4 h-4 text-nc-content-gray-subtle flex-none"
                      icon="ncUser"
                    />
                    <GeneralIcon v-else class="w-4 h-4 text-nc-content-gray-subtle flex-none" icon="ncSettings" />
                    <span class="truncate">{{ option.label }}</span>
                    <RolesBadge
                      v-if="option.role && option.group === 'User'"
                      :border="false"
                      :role="option.role"
                      size="xs"
                      class="flex-none"
                    />
                  </div>
                  <GeneralIcon
                    v-if="option.value === runAsSelectValue"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4 flex-none"
                    icon="ncCheck"
                  />
                </div>
              </a-select-option>
            </a-select-opt-group>
          </template>
        </NcSelect>
      </div>
    </div>
    <div class="flex-1" />
    <NcDivider />
    <div class="px-4 py-3 flex flex-col gap-4">
      <div>
        <div class="text-nc-content-gray text-bodyDefaultSmBold mb-2 font-semibold">
          {{ $t('labels.createdBy') }}
        </div>
        <NcUserInfo :user="(workflow as any).created_by_user" />
      </div>
      <div v-if="workflow?.updated_at" class="flex justify-between">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
          {{ $t('labels.lastModified') }}
        </div>
        <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
          {{ dayjs(workflow.updated_at).format('DD MMM YYYY, h:mm A') }}
        </div>
      </div>
      <div class="flex justify-between">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
          {{ $t('labels.createdOn') }}
        </div>
        <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
          {{ dayjs(workflow.created_at).format('DD MMM YYYY, h:mm A') }}
        </div>
      </div>
    </div>

    <GeneralModal v-model:visible="showRunAsWarning" size="small" centered>
      <div class="flex flex-col p-6">
        <div class="flex flex-row pb-2 mb-3 font-medium text-lg text-nc-content-gray">Change Run As</div>
        <div class="mb-3 text-nc-content-gray-subtle">
          The current "Run As" setting has a higher privilege than your role. Once changed, you won't be able to set it back.
        </div>
        <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
          <NcButton type="secondary" size="small" @click="onCancelRunAsChange">
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton type="danger" size="small" @click="onConfirmRunAsChange"> Change </NcButton>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>
