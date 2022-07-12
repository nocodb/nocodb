<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import useTableCreate from '../../composables/useTableCreate'
import { validateTableName } from '~/utils/validation'

const { modelValue = false } = defineProps<{ modelValue?: boolean }>()

const emit = defineEmits(['update:modelValue'])

const idTypes = [
  { value: 'AI', text: 'Auto increment number' },
  { value: 'AG', text: 'Auto generated string' },
]

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const valid = ref(false)
const isIdToggleAllowed = ref(false)
const isAdvanceOptVisible = ref(false)
const { table, createTable, generateUniqueTitle, tables, project } = useTableCreate()

const prefix = computed(() => project?.value?.prefix || '')

const validateDuplicateAlias = (v: string) => {
  return (tables?.value || []).every((t) => t.title !== (v || '')) || 'Duplicate table alias'
}
const validateLeadingOrTrailingWhiteSpace = (v: string) => {
  return !/^\s+|\s+$/.test(v) || 'Leading or trailing whitespace not allowed in table name'
}
const validateDuplicate = (v: string) => {
  return (tables?.value || []).every((t) => t.table_name.toLowerCase() !== (v || '').toLowerCase()) || 'Duplicate table name'
}

const inputEl = ref<any>()

onMounted(() => {
  generateUniqueTitle()
  nextTick(() => {
    const el = inputEl?.value?.$el
    el?.querySelector('input')?.focus()
    el?.querySelector('input')?.select()
  })
})
</script>

<template>
  <v-dialog
    v-model="dialogShow"
    persistent
    max-width="550"
    @keydown.esc="dialogShow = false"
    @keydown.enter="$emit('create', table)"
  >
    <!-- Create A New Table -->
    <v-card class="elevation-1 backgroundColor nc-create-table-card">
      <v-form ref="form" v-model="valid">
        <v-card-title class="primary subheading white--text py-2">
          {{ $t('activity.createTable') }}
        </v-card-title>

        <v-card-text class="py-6 px-10">
          <!-- hint="Enter table name" -->
          <v-text-field
            ref="inputEl"
            v-model="table.title"
            solo
            flat
            persistent-hint
            dense
            hide-details1
            :rules="[validateTableName, validateDuplicateAlias]"
            :hint="$t('msg.info.enterTableName')"
            class="mt-4 caption nc-table-name"
          />

          <div class="d-flex justify-end">
            <div class="grey--text caption pointer" @click="isAdvanceOptVisible = !isAdvanceOptVisible">
              {{ isAdvanceOptVisible ? 'Hide' : 'Show' }} more
              <v-icon x-small color="grey">
                {{ isAdvanceOptVisible ? 'mdi-minus-circle-outline' : 'mdi-plus-circle-outline' }}
              </v-icon>
            </div>
          </div>

          <div class="nc-table-advanced-options" :class="{ active: isAdvanceOptVisible }">
            <!-- hint="Table name as saved in database" -->
            <v-text-field
              v-if="!project.prefix"
              v-model="table.table_name"
              solo
              flat
              dense
              persistent-hint
              :rules="[validateDuplicate]"
              :hint="$t('msg.info.tableNameInDb')"
              class="mt-4 caption nc-table-name-alias"
            />

            <div class="mt-5">
              <label class="add-default-title grey--text">
                <!-- Add Default Columns -->
                {{ $t('msg.info.addDefaultColumns') }}
              </label>

              <div class="d-flex caption justify-space-between align-center">
                <v-checkbox
                  key="chk1"
                  v-model="table.columns"
                  dense
                  class="mt-0"
                  color="info"
                  hide-details
                  value="id"
                  @click.capture.prevent.stop="
                    () => {
                      $toast.info('ID column is required, you can rename this later if required.').goAway(3000)
                      if (!table.columns.includes('id')) {
                        table.columns.push('id')
                      }
                    }
                  "
                >
                  <template #label>
                    <div>
                      <span v-if="!isIdToggleAllowed" class="caption" @dblclick="isIdToggleAllowed = true">id</span>
                      <v-select
                        v-else
                        v-model="idType"
                        style="max-width: 100px"
                        class="caption"
                        outlined
                        dense
                        hide-details
                        :items="idTypes"
                      />
                    </div>
                  </template>
                </v-checkbox>
                <v-checkbox key="chk2" v-model="table.columns" dense class="mt-0" color="info" hide-details value="title">
                  <template #label>
                    <span class="caption">title</span>
                  </template>
                </v-checkbox>
                <v-checkbox key="chk3" v-model="table.columns" dense class="mt-0" color="info" hide-details value="created_at">
                  <template #label>
                    <span class="caption">created_at</span>
                  </template>
                </v-checkbox>
                <v-checkbox key="chk4" v-model="table.columns" dense class="mt-0" color="info" hide-details value="updated_at">
                  <template #label>
                    <span class="caption">updated_at</span>
                  </template>
                </v-checkbox>
              </div>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="py-4 px-10">
          <v-spacer />
          <v-btn class="" @click="dialogShow = false">
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn :disabled="!valid" color="primary" class="nc-create-table-submit" @click="createTable">
            {{ $t('general.submit') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
::v-deep {
  .v-text-field__details {
    padding: 0 2px !important;

    .v-messages:not(.error--text) {
      .v-messages__message {
        color: grey;
        font-size: 0.65rem;
      }
    }
  }
}

.add-default-title {
  font-size: 0.65rem;
}

.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 200px;
  }
}
</style>
