<script lang="ts" setup>
import { ProjectRoles } from 'nocodb-sdk'

/** MOCK — see `useInviteLinks`. Nothing here reaches the server. */
const props = defineProps<{ index: number }>()

const emit = defineEmits(['done'])

const { links, saveLink, deleteLink } = useInviteLinks()

// Owner is never handed out by a link; it is granted to a named person.
const allowedRoles = computed(() =>
  Object.values(ProjectRoles).filter((r) => r !== ProjectRoles.OWNER && r !== ProjectRoles.NO_ACCESS),
)

const draft = reactive({
  role: links.value[props.index]?.role ?? ProjectRoles.VIEWER,
  anyEmail: links.value[props.index]?.anyEmail ?? true,
  domain: links.value[props.index]?.domain ?? '',
})

const canDelete = computed(() => links.value.length > 1)

function onRoleChange(role: ProjectRoles) {
  draft.role = role
}

function onSave() {
  saveLink(props.index, { ...draft })
  emit('done')
}

function onDelete() {
  deleteLink(props.index)
  emit('done')
}

watch(
  () => props.index,
  (i) => {
    Object.assign(draft, {
      role: links.value[i]?.role ?? ProjectRoles.VIEWER,
      anyEmail: links.value[i]?.anyEmail ?? true,
      domain: links.value[i]?.domain ?? '',
    })
  },
)
</script>

<template>
  <div class="flex flex-col gap-4 px-6 pt-4 pb-5">
    <div class="flex flex-col gap-1.5">
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2">{{ $t('labels.permission') }}</div>
      <RolesSelectorV2
        :on-role-change="onRoleChange"
        :role="draft.role"
        :roles="allowedRoles"
        trigger-variant="field"
        size="lg"
        placement="bottomLeft"
      />
    </div>

    <div class="flex flex-col">
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray-subtle2 pb-1">{{ $t('labels.whoCanAccess') }}</div>

      <button class="flex items-center gap-3 min-h-10 text-left" data-testid="nc-hub-any-email" @click="draft.anyEmail = true">
        <span
          class="w-4 h-4 rounded-full flex-none box-border"
          :style="
            draft.anyEmail ? { border: '5px solid var(--color-brand-500)' } : { border: '1.5px solid var(--nc-border-gray-dark)' }
          "
        />
        <span class="text-bodyDefault">{{ $t('labels.allowAnyEmail') }}</span>
      </button>

      <div class="flex items-center gap-3 min-h-10">
        <button
          class="flex items-center gap-3 flex-none text-left"
          data-testid="nc-hub-domain-only"
          @click="draft.anyEmail = false"
        >
          <span
            class="w-4 h-4 rounded-full flex-none box-border"
            :style="
              !draft.anyEmail
                ? { border: '5px solid var(--color-brand-500)' }
                : { border: '1.5px solid var(--nc-border-gray-dark)' }
            "
          />
          <span class="text-bodyDefault whitespace-nowrap">{{ $t('labels.onlyAllowEmailsFrom') }}</span>
        </button>

        <div
          class="flex-1 flex items-center gap-1.5 h-10 px-3 rounded-lg border-1 border-nc-border-gray-medium box-border"
          :class="{ 'opacity-55': draft.anyEmail }"
        >
          <span class="text-nc-content-gray-muted">{{ '@' }}</span>
          <input
            v-model="draft.domain"
            class="flex-1 min-w-0 border-0 outline-none bg-transparent text-bodyDefault text-nc-content-gray"
            placeholder="example.com"
            @focus="draft.anyEmail = false"
          />
        </div>
      </div>
    </div>

    <div class="h-px bg-nc-border-gray-light" />

    <div class="flex items-center justify-between gap-3">
      <NcButton type="danger" size="medium" :disabled="!canDelete" data-testid="nc-hub-delete-link" @click="onDelete">
        {{ $t('activity.deleteLink') }}
      </NcButton>

      <div class="flex gap-2">
        <NcButton type="secondary" size="medium" @click="emit('done')">{{ $t('labels.cancel') }}</NcButton>
        <NcButton type="primary" size="medium" data-testid="nc-hub-save-link" @click="onSave">{{ $t('general.save') }}</NcButton>
      </div>
    </div>
  </div>
</template>
