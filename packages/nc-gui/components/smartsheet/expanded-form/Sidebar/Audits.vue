<script setup lang="ts">
import { type AuditType, ProjectRoles } from 'nocodb-sdk'

const { user } = useGlobal()

const { isUIAllowed } = useRoles()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const meta = inject(MetaInj, ref())

const baseUsers = computed(() => (meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : []))

const { audits, isAuditLoading } = useExpandedFormStoreOrThrow()

const auditsWrapperEl = ref<HTMLElement | null>(null)

function scrollToAudit(auditId?: string) {
  if (!auditId) return

  const auditEl = auditsWrapperEl.value?.querySelector(`.nc-audit-item.${auditId}`)
  if (auditEl) {
    auditEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
}

const createdByAudit = (
  comment: AuditType & {
    created_display_name?: string
  },
) => {
  if (comment.user === user.value?.email) {
    return 'You'
  } else if (comment.created_display_name?.trim()) {
    return comment.created_display_name || 'Shared source'
  } else if (comment.user) {
    return comment.user
  } else {
    return 'Shared source'
  }
}

const getUserRole = (email: string) => {
  const user = baseUsers.value.find((user) => user.email === email)
  if (!user) return ProjectRoles.NO_ACCESS

  return user.roles || ProjectRoles.NO_ACCESS
}
watch(
  () => audits.value.length,
  (auditCount) => {
    nextTick(() => {
      setTimeout(() => {
        scrollToAudit(audits.value[auditCount - 1]?.id)
      }, 100)
    })
  },
)
</script>

<template>
  <div class="h-full pb-1">
    <div v-if="isAuditLoading" class="flex flex-col items-center justify-center w-full h-full">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else ref="auditsWrapperEl" class="flex flex-col h-full py-1 nc-scrollbar-thin">
      <template v-if="audits.length === 0">
        <div class="flex flex-col text-center justify-center h-full">
          <div class="text-center text-3xl text-gray-600">
            <MdiHistory />
          </div>
          <div class="font-bold text-center my-1 text-gray-600">See changes to this record</div>
        </div>
      </template>

      <div v-for="audit of audits" :key="audit.id" :class="`${audit.id}`" class="nc-audit-item">
        <div class="group gap-3 overflow-hidden px-3 py-2 hover:bg-gray-100">
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-3 flex-1 w-full">
              <GeneralUserIcon :email="audit.created_by_email" :name="audit.created_display_name" class="mt-0.5" size="medium" />
              <div class="flex h-[28px] items-center gap-3 w-[calc(100%_-_40px)]">
                <NcDropdown placement="topLeft" :trigger="['hover']" class="flex-none max-w-[calc(100%_-_72px)]">
                  <div class="truncate text-gray-800 font-medium !text-small !leading-[18px] overflow-hidden">
                    {{ createdByAudit(audit) }}
                  </div>

                  <template #overlay>
                    <div class="bg-white rounded-lg">
                      <div class="flex items-center gap-4 py-3 px-2">
                        <GeneralUserIcon
                          class="!w-8 !h-8 border-1 border-gray-200 rounded-full"
                          :name="audit.created_display_name"
                          :email="audit.created_by_email"
                        />
                        <div class="flex flex-col">
                          <div class="font-semibold text-gray-800">
                            {{ createdByAudit(audit) }}
                          </div>
                          <div class="text-xs text-gray-600">
                            {{ audit.created_by_email }}
                          </div>
                        </div>
                      </div>
                      <div
                        v-if="isUIAllowed('dataEdit')"
                        class="px-3 rounded-b-lg !text-[13px] items-center text-gray-600 flex gap-1 bg-gray-100 py-1.5"
                      >
                        Has <RolesBadge size="sm" :border="false" :role="getUserRole(audit.created_by_email!)" />
                        role in base
                      </div>
                    </div>
                  </template>
                </NcDropdown>
                <div class="text-xs text-gray-500">
                  {{ timeAgo(audit.created_at!) }}
                </div>
              </div>
            </div>
          </div>
          <div v-dompurify-html="audit.details" class="!text-[13px] text-gray-500 !leading-5 !pl-9"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.red.lighten-4) {
  @apply bg-red-100 rounded-md line-through;
}

.nc-audit-item {
  @apply gap-3;
}

:deep(.green.lighten-4) {
  @apply bg-green-100 rounded-md !mr-3;
}
</style>
