<script setup lang="ts">


import { ViewTypes } from "nocodb-sdk";
import useViewCreate from "~/composables/useViewCreate";

const { modelValue, type } = defineProps<{ type: ViewTypes, modelValue: boolean }>();

const emit = defineEmits(["update:modelValue"]);

const dialogShow = computed({
  get() {
    return modelValue;
  },
  set(v) {
    emit("update:modelValue", v);
  }
});

const { view, createView, generateUniqueTitle } = useViewCreate(async () => {
});


/*import inflection from 'inflection'

export default {
  name: 'DlgViewCreate',
  props: ['value'],
  data() {
    return {
      view: {
        name: '',
      },
    }
  },
  computed: {
    dialogShow: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit('input', v)
      },
    },
    projectPrefix() {
      return this.$store.getters['project/GtrProjectPrefix']
    },
  },
  watch: {
    'view.alias': function (v) {
      this.$set(this.view, 'name', `${this.projectPrefix || ''}${inflection.underscore(v)}`)
    },
  },
  mounted() {
    setTimeout(() => {
      this.$refs.input.$el.querySelector('input').focus()
    }, 100)
  },
}*/
</script>

<template>
  <v-dialog v-model="dialogShow" max-width="500">
    <v-card class="elevation-20">
      <v-card-title class="grey darken-2 subheading" style="height: 30px" />
      <v-card-text class="pt-4 pl-4">
        <p class="headline">
          {{ $t('general.create') }} <span class="text-capitalize">{{ typeAlias }}</span> {{ $t('objects.view') }}
        </p>
        <v-form ref="form" v-model="valid" @submit.prevent="createView">
          <!-- label="View Name" -->
          <v-text-field
            ref="name"
            v-model="view.title"
            :label="$t('labels.viewName')"
            :rules="[
              v => !!v || 'View name required',
              v => viewsList.every(v1 => (v1.alias || v1.title) !== v) || 'View name should be unique',
            ]"
            autofocus
          />
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn class="" small @click="$emit('input', false)">
          {{ $t('general.cancel') }}
        </v-btn>
        <v-btn small :loading="loading" class="primary" :disabled="!valid" @click="createView">
          {{ $t('general.submit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped></style>
