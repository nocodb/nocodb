<script setup lang="ts">
import { inject } from '@vue/runtime-core'
import type { TableType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import type { Ref } from '#imports'
import { ActiveViewInj, MetaInj, ViewListInj } from '~/components'
import useViewCreate from '~/composables/useViewCreate'

const { modelValue, type } = defineProps<{ type: ViewTypes; modelValue: boolean }>()

const emit = defineEmits(['update:modelValue', 'created'])

const valid = ref(false)

const viewList = inject(ViewListInj)
const activeView = inject(ActiveViewInj)

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const { view, createView, generateUniqueTitle, loading } = useViewCreate(inject(MetaInj) as Ref<TableType>, (view) =>
  emit('created', view),
)

const typeAlias = computed(
  () =>
    ({
      [ViewTypes.GRID]: 'grid',
      [ViewTypes.GALLERY]: 'gallery',
      [ViewTypes.FORM]: 'form',
      [ViewTypes.KANBAN]: 'kanban',
    }[type]),
)

const inputEl = ref<any>()
const form = ref<any>()
watch(
  () => modelValue,
  (v) => {
    if (v) {
      generateUniqueTitle(viewList?.value || [])
      nextTick(() => {
        const el = inputEl?.value?.$el
        el?.querySelector('input')?.focus()
        el?.querySelector('input')?.select()
        form?.value?.validate()
      })
    }
  },
)

/*  name: 'CreateViewDialog',
  props: [
    'value',
    'nodes',
    'table',
    'alias',
    'show_as',
    'viewsCount',
    'primaryValueColumn',
    'meta',
    'copyView',
    'viewsList',
    'selectedViewId',
  ],
  data: () => ({
    valid: false,
    view_name: '',
    loading: false,
    queryParams: {},
  }),
  computed: {
    localState: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
    typeAlias() {
      return {
        [ViewTypes.GRID]: 'grid',
        [ViewTypes.GALLERY]: 'gallery',
        [ViewTypes.FORM]: 'form',
        [ViewTypes.KANBAN]: 'kanban',
      }[this.show_as];
    },
  },
  mounted() {
    try {
      if (this.copyView && this.copyView.query_params) {
        this.queryParams = { ...JSON.parse(this.copyView.query_params) };
      }
    } catch (e) {}
    this.view_name = `${this.alias || this.table}${this.viewsCount}`;

    this.$nextTick(() => {
      const input = this.$refs.name.$el.querySelector('input');
      input.setSelectionRange(0, this.view_name.length);
      input.focus();
    });
  }, */
</script>

<template>
  <v-dialog v-model="dialogShow" max-width="600" min-width="400">
    <v-card class="elevation-20">
      <v-card-title class="grey darken-2 subheading" style="height: 30px" />
      <v-card-text class="pt-4 pl-4">
        <p class="headline">
          {{ $t('general.create') }} <span class="text-capitalize">{{ typeAlias }}</span> {{ $t('objects.view') }}
        </p>
        <v-form ref="form" v-model="valid" @submit.prevent="createView">
          <!-- label="View Name" -->
          <v-text-field
            ref="inputEl"
            v-model="view.title"
            :label="$t('labels.viewName')"
            :rules="[
              (v) => !!v || 'View name required',
              (v) => (viewList || []).every((v1) => (v1.alias || v1.title) !== v) || 'View name should be unique',
            ]"
            autofocus
          />
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn class="" small @click="emit('update:modelValue', false)">
          {{ $t('general.cancel') }}
        </v-btn>
        <v-btn small :loading="loading" class="primary" :disabled="!valid" @click="createView(type, activeView.id)">
          {{ $t('general.submit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped></style>
