<script setup lang="ts">
/**
 * "+ New record" for an interface link field's "Add records through a form" —
 * renders only when an interface host provides `LinkRecordCreateInj` and the
 * field has the option on. The classic expanded-form create stays separate.
 */
const emit = defineEmits<{ opened: [] }>()

const { isMobileMode } = useGlobal()

const column = inject(ColumnInj)

const linkRecordCreate = inject(LinkRecordCreateInj, ref(null))

const fieldElement = inject(InterfaceFieldElementInj, undefined)

const { rowId, onRecordCreatedAndLinked } = useLTARStoreOrThrow()

const isEnabled = computed(
  () =>
    !!rowId.value && !!column?.value && !!linkRecordCreate.value?.isEnabled(column.value, fieldElement?.value?.fieldElementId),
)

function onClick() {
  const parentRowId = rowId.value
  if (!isEnabled.value || !column?.value || !parentRowId) return

  emit('opened')
  linkRecordCreate.value?.create({
    column: column.value,
    rowId: parentRowId,
    elementId: fieldElement?.value?.fieldElementId,
    onCreated: (created) => onRecordCreatedAndLinked(created),
  })
}
</script>

<template>
  <NcButton
    v-if="isEnabled"
    size="small"
    class="!hover:(bg-nc-bg-default text-nc-content-brand) !h-7 !text-small"
    type="secondary"
    data-testid="nc-link-record-create-btn"
    @click="onClick"
  >
    <div class="flex items-center gap-1">
      <MdiPlus v-if="!isMobileMode" class="h-4 w-4" />
      {{ $t('activity.newRecord') }}
    </div>
  </NcButton>
</template>
