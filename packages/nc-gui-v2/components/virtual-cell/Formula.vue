<script lang="ts" setup>
import { computed } from '#imports'
import { ColumnInj } from '~/components'
import { handleTZ } from '~/utils/dateTimeUtils'
import { replaceUrlsWithLink } from '~/utils/urlUtils'
const column = inject(ColumnInj)
const value = inject('value')

const { isPg } = useProject()

const showEditFormulaWarning = ref(false)

const showEditFormulaWarningMessage = () => {
  showEditFormulaWarning.value = true
  setTimeout(() => {
    showEditFormulaWarning.value = false
  }, 3000)
}

const result = computed(() => {
  if (isPg) {
    return handleTZ(value)
  }
  return value
})

const urls = computed(() => {
  return replaceUrlsWithLink(result.value)
})
</script>

<template>
  <div>
    <v-tooltip v-if="column && column.colOptions && column.colOptions.error" bottom color="error">
      <template #activator="{ on }">
        <span class="caption" v-on="on">ERR<span class="error--text">!</span></span>
      </template>
      <span class="font-weight-bold">{{ column.colOptions.error }}</span>
    </v-tooltip>
    <div class="formula-cell-wrapper" @dblclick="showEditFormulaWarningMessage">
      <div v-if="urls" v-html="urls" />
      <div v-else>
        {{ result }}
      </div>
      <div v-if="showEditFormulaWarning" class="edit-warning">
        <!-- TODO: i18n -->
        Warning: Formula fields should be configured in the field menu dropdown.
      </div>
    </div>
  </div>
</template>

<style scoped>
.formula-cell-wrapper {
  padding: 10px;
}

.edit-warning {
  text-align: left;
  margin-top: 10px;
  color: #e65100;
}
</style>
