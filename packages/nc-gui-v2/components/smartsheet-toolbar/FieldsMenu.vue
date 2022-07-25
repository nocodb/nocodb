<script setup lang="ts">
import { computed, inject } from 'vue'
import { ActiveViewInj, FieldsInj, IsLockedInj, MetaInj, ReloadViewDataHookInj } from '~/context'
import useViewColumns from '~/composables/useViewColumns'
import MdiMenuDownIcon from '~icons/mdi/menu-down'
import MdiEyeIcon from '~icons/mdi/eye-off-outline'

const { fieldsOrder, coverImageField, modelValue } = defineProps<{
  coverImageField?: string
  fieldsOrder?: string[]
  modelValue?: Record<string, boolean>
}>()

const meta = inject(MetaInj)
const activeView = inject(ActiveViewInj)
const reloadDataHook = inject(ReloadViewDataHookInj)
const isLocked = inject(IsLockedInj)
const rootFields = inject(FieldsInj)

const isAnyFieldHidden = computed(() => {
  return false
  // todo: implement
  // return meta?.fields?.some(field => field.hidden)
})

const {
  showSystemFields,
  sortedAndFilteredFields,
  fields,
  loadViewColumns,
  filteredFieldList,
  filterQuery,
  showAll,
  hideAll,
  saveOrUpdate,
} = useViewColumns(activeView, meta, false, () => reloadDataHook?.trigger())

watch(
  () => activeView?.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta?.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)
watch(
  () => sortedAndFilteredFields.value,
  (v) => {
    if (rootFields) rootFields.value = v || []
  },
  { immediate: true },
)

/* import draggable from 'vuedraggable'
import { getSystemColumnsIds } from 'nocodb-sdk'
import { getUIDTIcon } from '~/components/project/spreadsheet/helpers/uiTypes'

export default {
  name: 'FieldsMenu',
  components: {
    Draggable: draggable,
  },
  props: {
    coverImageField: String,
    groupingField: String,
    isGallery: Boolean,
    isKanban: Boolean,
    sqlUi: [Object, Function],
    meta: Object,
    fieldsOrder: [Array],
    value: [Object, Array],
    fieldList: [Array, Object],
    showSystemFields: {
      type: [Boolean, Number],
      default: false,
    },
    isLocked: Boolean,
    isPublic: Boolean,
    viewId: String,
  },
  data: () => ({
    fields: [],
    fieldFilter: '',
    showFields: {},
    fieldsOrderLoc: [],
  }),
  computed: {
    systemColumnsIds() {
      return getSystemColumnsIds(this.meta && this.meta.columns)
    },
    attachmentFields() {
      return [
        ...(this.meta && this.meta.columns ? this.meta.columns.filter((f) => f.uidt === 'Attachment') : []),
        {
          alias: 'None',
          id: null,
        },
      ]
    },
    singleSelectFields() {
      return [
        ...(this.meta && this.meta.columns ? this.meta.columns.filter((f) => f.uidt === 'SingleSelect') : []),
        {
          alias: 'None',
          id: null,
        },
      ]
    },
    coverImageFieldLoc: {
      get() {
        return this.coverImageField
      },
      set(val) {
        this.$emit('update:coverImageField', val)
      },
    },
    groupingFieldLoc: {
      get() {
        return this.groupingField
      },
      set(val) {
        this.$emit('update:groupingField', val)
      },
    },
    columnMeta() {
      return this.meta && this.meta.columns
        ? this.meta.columns.reduce(
            (o, c) => ({
              ...o,
              [c.title]: c,
            }),
            {},
          )
        : {}
    },

    isAnyFieldHidden() {
      return this.fields.some((f) => !(!this.showSystemFieldsLoc && this.systemColumnsIds.includes(f.fk_column_id)) && !f.show) // Object.values(this.showFields).some(v => !v)
    },
    showSystemFieldsLoc: {
      get() {
        return this.showSystemFields
      },
      set(v) {
        this.$emit('update:showSystemFields', v)
        this.showFields = this.fields.reduce((o, c) => ({ [c.title]: c.show, ...o }), {})
        this.$emit(
          'update:fieldsOrder',
          this.fields.map((c) => c.title),
        )

        this.$e('a:fields:system-fields')
      },
    },
  },
  watch: {
    async viewId(v) {
      if (v) {
        await this.loadFields()
      }
    },
    fieldList(f) {
      this.fieldsOrderLoc = [...f]
    },
    showFields: {
      handler(v) {
        this.$nextTick(() => {
          this.$emit('input', v)
        })
      },
      deep: true,
    },
    value(v) {
      this.showFields = v || []
    },
    fieldsOrder(n, o) {
      if ((n && n.join()) !== (o && o.join())) {
        this.fieldsOrderLoc = n
      }

      this.fieldsOrderLoc = n && n.length ? n : [...this.fieldList]
    },
    fieldsOrderLoc: {
      handler(n, o) {
        if ((n && n.join()) !== (o && o.join())) {
          this.$emit('update:fieldsOrder', n)
        }
      },
      deep: true,
    },
  },
  created() {
    this.loadFields()
    this.showFields = this.value
    this.fieldsOrderLoc = this.fieldsOrder && this.fieldsOrder.length ? this.fieldsOrder : [...this.fieldList]
  },
  methods: {
    async loadFields() {
      let fields = []
      let order = 1
      if (this.viewId) {
        const data = await this.$api.dbViewColumn.list(this.viewId)
        const fieldById = data.reduce(
          (o, f) => ({
            ...o,
            [f.fk_column_id]: f,
          }),
          {},
        )
        fields = this.meta.columns
          .map((c) => ({
            title: c.title,
            fk_column_id: c.id,
            ...(fieldById[c.id] ? fieldById[c.id] : {}),
            order: (fieldById[c.id] && fieldById[c.id].order) || order++,
            icon: getUIDTIcon(c.uidt),
          }))
          .sort((a, b) => a.order - b.order)
      } else if (this.isPublic) {
        fields = this.meta.columns
      }

      this.fields = fields

      this.$emit(
        'input',
        this.fields.reduce(
          (o, c) => ({
            ...o,
            [c.title]: c.show,
          }),
          {},
        ),
      )
      this.$emit(
        'update:fieldsOrder',
        this.fields.map((c) => c.title),
      )
    },
    async saveOrUpdate(field, i) {
      if (!this.isPublic && this._isUIAllowed('fieldsSync')) {
        if (field.id) {
          await this.$api.dbViewColumn.update(this.viewId, field.id, field)
        } else {
          this.fields[i] = await this.$api.dbViewColumn.create(this.viewId, field)
        }
      }
      this.$emit('updated')
      this.$emit(
        'input',
        this.fields.reduce(
          (o, c) => ({
            ...o,
            [c.title]: c.show,
          }),
          {},
        ),
      )
      this.$emit(
        'update:fieldsOrder',
        this.fields.map((c) => c.title),
      )

      this.$e('a:fields:show-hide')
    },
    async showAll() {
      if (!this.isPublic) {
        await this.$api.dbView.showAllColumn(this.viewId)
      }
      for (const f of this.fields) {
        f.show = true
      }
      this.$emit('updated')

      this.showFields = (this.fieldsOrderLoc || Object.keys(this.showFields)).reduce((o, k) => ((o[k] = true), o), {})

      this.$e('a:fields:show-all')
    },
    async hideAll() {
      if (!this.isPublic) {
        await this.$api.dbView.hideAllColumn(this.viewId)
      }
      for (const f of this.fields) {
        f.show = false
      }
      this.$emit('updated')

      this.$nextTick(() => {
        this.showFields = (this.fieldsOrderLoc || Object.keys(this.showFields)).reduce((o, k) => ((o[k] = false), o), {})
      })

      this.$e('a:fields:hide-all')
    },
    onMove(event) {
      if (this.fields.length - 1 === event.moved.newIndex) {
        this.$set(this.fields[event.moved.newIndex], 'order', this.fields[event.moved.newIndex - 1].order + 1)
      } else if (event.moved.newIndex === 0) {
        this.$set(this.fields[event.moved.newIndex], 'order', this.fields[1].order / 2)
      } else {
        this.$set(
          this.fields[event.moved.newIndex],
          'order',
          (this.fields[event.moved.newIndex - 1].order + this.fields[event.moved.newIndex + 1].order) / 2,
        )
      }
      this.saveOrUpdate(this.fields[event.moved.newIndex], event.moved.newIndex)
      this.$e('a:fields:reorder')
    },
  },
} */
</script>

<template>
  <v-menu>
    <template #activator="{ props }">
      <v-badge :value="isAnyFieldHidden" color="primary" dot overlap v-bind="props">
        <v-btn
          v-t="['c:fields']"
          class="nc-fields-menu-btn px-2 nc-remove-border"
          :disabled="isLocked"
          outlined
          small
          text
          :class="{
            'primary lighten-5 grey--text text--darken-3': isAnyFieldHidden,
          }"
        >
          <!--          <v-icon small class="mr-1" color="#777"> mdi-eye-off-outline </v-icon> -->
          <MdiEyeIcon class="mr-1 text-grey"></MdiEyeIcon>
          <!-- Fields -->
          <span class="text-sm text-capitalize">{{ $t('objects.fields') }}</span>
          <MdiMenuDownIcon class="text-grey"></MdiMenuDownIcon>
        </v-btn>
      </v-badge>
    </template>

    <v-list density="compact" class="pt-0" min-width="280" @click.stop>
      <div class="nc-fields-list py-1">
        <!--        <Draggable v-model="fields" @start="drag = true" @end="drag = false" @change="onMove($event)"> -->
        <v-list-item v-for="(field, i) in filteredFieldList" :key="field.id" dense>
          <input
            :id="`show-field-${field.id}`"
            v-model="field.show"
            type="checkbox"
            class="mt-0 pt-0"
            @click.stop
            @change="saveOrUpdate(field, i)"
          />
          <!--                        @change="saveOrUpdate(field, i)"> -->
          <!--            <template #label>
                        &lt;!&ndash;                <v-icon small class="mr-1">
                          {{ field.icon }}
                        </v-icon> &ndash;&gt;
                        <span class="caption">{{ field.title }}</span>
                      </template> -->
          <!--          </input> -->
          <label :for="`show-field-${field.id}`" class="ml-2 text-sm">{{ field.title }}</label>
          <v-spacer />

          <!--          <v-icon small color="grey" :class="`align-self-center drag-icon nc-child-draggable-icon-${field}`"> mdi-drag </v-icon> -->
        </v-list-item>
        <!--        </Draggable> -->
      </div>
      <v-divider class="my-2" />

      <v-list-item v-if="!isPublic" dense>
        <!--
show_system_fields
<v-checkbox v-model="showSystemFields" class="mt-0 pt-0" dense hide-details @click.stop>
          <template #label>
            <span class="caption text-sm">
              &lt;!&ndash; Show System Fields &ndash;&gt;
              {{ $t('activity.showSystemFields') }}
            </span>
          </template>
        </v-checkbox> -->
        <input :id="`${activeView?.id}-show-system-fields`" v-model="showSystemFields" type="checkbox" />
        <label :for="`${activeView.id}-show-system-fields`" class="caption text-sm ml-2">{{
          $t('activity.showSystemFields')
        }}</label>
      </v-list-item>
      <v-list-item dense class="mt-2 list-btn mb-3">
        <v-btn small class="elevation-0 grey--text text-sm text-capitalize" @click.stop="showAll">
          <!-- Show All -->
          {{ $t('general.showAll') }}
        </v-btn>
        <v-btn small class="elevation-0 grey--text text-sm text-capitalize" @click.stop="hideAll">
          <!-- Hide All -->
          {{ $t('general.hideAll') }}
        </v-btn>
      </v-list-item>
    </v-list>

    <!--
    <v-list dense class="pt-0" min-width="280" @click.stop>
      <template v-if="isGallery && _isUIAllowed('updateCoverImage')">
        <div class="pa-2">
          <v-select
            v-model="coverImageFieldLoc"
            label="Cover Image"
            class="caption field-caption"
            dense
            outlined
            :items="attachmentFields"
            item-text="alias"
            item-value="id"
            hide-details
            @click.stop
          >
            <template #prepend-inner>
              <v-icon small class="field-icon"> mdi-image </v-icon>
            </template>
          </v-select>
        </div>
        <v-divider />
      </template>

      <template v-if="isKanban">
        <div class="pa-2">
          <v-select
            v-model="groupingFieldLoc"
            label="Grouping Field"
            class="caption field-caption"
            dense
            outlined
            :items="singleSelectFields"
            item-text="alias"
            item-value="title"
            hide-details
            @click.stop
          >
            <template #prepend-inner>
              <v-icon small class="field-icon"> mdi-select-group </v-icon>
            </template>
          </v-select>
        </div>
        <v-divider />
      </template>

      <v-list-item dense class="">
        <v-text-field
          v-model="fieldFilter"
          dense
          flat
          class="caption mt-3 mb-2"
          color="grey"
          :placeholder="$t('placeholder.searchFields')"
          hide-details
          @click.stop
        >
          &lt;!&ndash;          <template v-slot:prepend-inner>
          <v-icon small color="grey" class="mt-2">
            mdi-magnify
          </v-icon>
        </template> &ndash;&gt;
        </v-text-field>
      </v-list-item>
      <div class="nc-fields-list py-1">
        &lt;!&ndash;        <Draggable v-model="fields" @start="drag = true" @end="drag = false" @change="onMove($event)"> &ndash;&gt;
        <template v-for="(field, i) in fields">
          <v-list-item
            v-show="
              (!fieldFilter || (field.title || '').toLowerCase().includes(fieldFilter.toLowerCase())) &&
              !(!showSystemFieldsLoc && systemColumnsIds.includes(field.fk_column_id))
            "
            :key="field.id"
            dense
          >
            <v-checkbox v-model="field.show" class="mt-0 pt-0" dense hide-details @click.stop @change="saveOrUpdate(field, i)">
              <template #label>
                <v-icon small class="mr-1">
                  {{ field.icon }}
                </v-icon>
                <span class="caption">{{ field.title }}</span>
              </template>
            </v-checkbox>
            <v-spacer />
            <v-icon small color="grey" :class="`align-self-center drag-icon nc-child-draggable-icon-${field}`"> mdi-drag </v-icon>
          </v-list-item>
        </template>
        &lt;!&ndash;        </Draggable> &ndash;&gt;
      </div>
      <v-divider class="my-2" />

      <v-list-item v-if="!isPublic" dense>
        <v-checkbox v-model="showSystemFieldsLoc" class="mt-0 pt-0" dense hide-details @click.stop>
          <template #label>
            <span class="caption">
              &lt;!&ndash; Show System Fields &ndash;&gt;
              {{ $t('activity.showSystemFields') }}
            </span>
          </template>
        </v-checkbox>
      </v-list-item>
      <v-list-item dense class="mt-2 list-btn mb-3">
        <v-btn small class="elevation-0 grey&#45;&#45;text" @click.stop="showAll">
          &lt;!&ndash; Show All &ndash;&gt;
          {{ $t('general.showAll') }}
        </v-btn>
        <v-btn small class="elevation-0 grey&#45;&#45;text" @click.stop="hideAll">
          &lt;!&ndash; Hide All &ndash;&gt;
          {{ $t('general.hideAll') }}
        </v-btn>
      </v-list-item>
    </v-list> -->
  </v-menu>
  <!--  <v-menu offset-y transition="slide-y-transition">
    <template #activator="{ on }">
      <v-badge :value="isAnyFieldHidden" color="primary" dot overlap>
        <v-btn
          v-t="['c:fields']"
          class="nc-fields-menu-btn px-2 nc-remove-border"
          :disabled="isLocked"
          outlined
          small
          text
          :class="{
            'primary lighten-5 grey&#45;&#45;text text&#45;&#45;darken-3': isAnyFieldHidden,
          }"
          v-on="on"
        >
          <v-icon small class="mr-1" color="#777"> mdi-eye-off-outline </v-icon>
          &lt;!&ndash; Fields &ndash;&gt;
          {{ $t('objects.fields') }}
          <v-icon small color="#777"> mdi-menu-down </v-icon>
        </v-btn>
      </v-badge>
    </template>

    <v-list dense class="pt-0" min-width="280" @click.stop>
      <template v-if="isGallery && _isUIAllowed('updateCoverImage')">
        <div class="pa-2">
          <v-select
            v-model="coverImageFieldLoc"
            label="Cover Image"
            class="caption field-caption"
            dense
            outlined
            :items="attachmentFields"
            item-text="alias"
            item-value="id"
            hide-details
            @click.stop
          >
            <template #prepend-inner>
              <v-icon small class="field-icon"> mdi-image </v-icon>
            </template>
          </v-select>
        </div>
        <v-divider />
      </template>

      <template v-if="isKanban">
        <div class="pa-2">
          <v-select
            v-model="groupingFieldLoc"
            label="Grouping Field"
            class="caption field-caption"
            dense
            outlined
            :items="singleSelectFields"
            item-text="alias"
            item-value="title"
            hide-details
            @click.stop
          >
            <template #prepend-inner>
              <v-icon small class="field-icon"> mdi-select-group </v-icon>
            </template>
          </v-select>
        </div>
        <v-divider />
      </template>

      <v-list-item dense class="">
        <v-text-field
          v-model="fieldFilter"
          dense
          flat
          class="caption mt-3 mb-2"
          color="grey"
          :placeholder="$t('placeholder.searchFields')"
          hide-details
          @click.stop
        >
          &lt;!&ndash;          <template v-slot:prepend-inner>
                      <v-icon small color="grey" class="mt-2">
                        mdi-magnify
                      </v-icon>
                    </template> &ndash;&gt;
        </v-text-field>
      </v-list-item>
      <div class="nc-fields-list py-1">
        <Draggable v-model="fields" @start="drag = true" @end="drag = false" @change="onMove($event)">
          <template v-for="(field, i) in fields">
            <v-list-item
              v-show="
                (!fieldFilter || (field.title || '').toLowerCase().includes(fieldFilter.toLowerCase())) &&
                !(!showSystemFieldsLoc && systemColumnsIds.includes(field.fk_column_id))
              "
              :key="field.id"
              dense
            >
              <v-checkbox v-model="field.show" class="mt-0 pt-0" dense hide-details @click.stop @change="saveOrUpdate(field, i)">
                <template #label>
                  <v-icon small class="mr-1">
                    {{ field.icon }}
                  </v-icon>
                  <span class="caption">{{ field.title }}</span>
                </template>
              </v-checkbox>
              <v-spacer />
              <v-icon small color="grey" :class="`align-self-center drag-icon nc-child-draggable-icon-${field}`">
                mdi-drag
              </v-icon>
            </v-list-item>
          </template>
        </Draggable>
      </div>
      <v-divider class="my-2" />

      <v-list-item v-if="!isPublic" dense>
        <v-checkbox v-model="showSystemFieldsLoc" class="mt-0 pt-0" dense hide-details @click.stop>
          <template #label>
            <span class="caption">
              &lt;!&ndash; Show System Fields &ndash;&gt;
              {{ $t('activity.showSystemFields') }}
            </span>
          </template>
        </v-checkbox>
      </v-list-item>
      <v-list-item dense class="mt-2 list-btn mb-3">
        <v-btn small class="elevation-0 grey&#45;&#45;text" @click.stop="showAll">
          &lt;!&ndash; Show All &ndash;&gt;
          {{ $t('general.showAll') }}
        </v-btn>
        <v-btn small class="elevation-0 grey&#45;&#45;text" @click.stop="hideAll">
          &lt;!&ndash; Hide All &ndash;&gt;
          {{ $t('general.hideAll') }}
        </v-btn>
      </v-list-item>
    </v-list>
  </v-menu> -->
</template>

<style scoped lang="scss">
/*::v-deep {
  .v-list-item {
    min-height: 30px;
  }

  .v-input--checkbox .v-icon {
    font-size: 12px !important;
  }

  .field-caption {
    .v-input__append-inner {
      margin-top: 4px !important;
    }

    .v-input__slot {
      min-height: 25px !important;
    }

    &.v-input input {
      max-height: 20px !important;
    }

    .field-icon {
      margin-top: 2px;
    }
  }
}

.drag-icon {
  cursor: all-scroll; !*cursor: grab;*!
}

.nc-fields-list {
  height: auto;
  max-height: 500px;
  overflow-y: auto;
}*/
</style>
