<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    workspaceId?: string | undefined
    modal?: boolean
    type?: string
    size?: NcButtonSize
    centered?: boolean
    innerClass?: string
    // isOpen: boolean
  }>(),
  {
    type: 'text',
  },
)

const { isUIAllowed } = useRoles()

const { baseCreateMode } = storeToRefs(useBases())

const baseStore = useBase()
const { isSharedBase } = storeToRefs(baseStore)

const baseCreateDlg = ref(false)

const size = computed(() => props.size || 'small')
const centered = computed(() => props.centered ?? true)

onMounted(() => {
  baseCreateMode.value = NcBaseCreateMode.FROM_SCRATCH
})
</script>

<template>
  <NcButton
    v-if="isUIAllowed('baseCreate') && !isSharedBase"
    v-e="['c:base:create']"
    :type="type"
    data-testid="nc-sidebar-create-base-btn"
    :size="size"
    :centered="centered"
    :inner-class="innerClass"
    full-width
    @click="baseCreateDlg = true"
  >
    <slot>
      <div class="flex items-center gap-2 w-full">
        <GeneralIcon icon="ncPlusCircleSolid" />

        <div class="flex flex-1">{{ $t('title.createBase') }}</div>

        <div class="px-1 flex-none text-bodySmBold !leading-[18px] text-nc-content-gray-subtle bg-nc-bg-gray-medium rounded">
          {{ renderAltOrOptlKey(true) }} D
        </div>
      </div>
    </slot>
    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" :default-base-create-mode="baseCreateMode" />
  </NcButton>
</template>

<style scoped></style>
