<script setup lang="ts">
import dayjs from 'dayjs'
import { computed } from '#imports'

interface Props {
  modelValue: string
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const localState = computed({
  get() {
    if (!modelValue || !dayjs(modelValue).isValid()) {
      return undefined
    }

    return (/^\d+$/.test(modelValue) ? dayjs(+modelValue) : dayjs(modelValue)).format('YYYY-MM-DD')
  },
  set(val?: string) {
    if (dayjs(val).isValid()) {
      emit('update:modelValue', val && dayjs(val).format('YYYY-MM-DD'))
    }
  },
})

/*

export default {
  name: 'DatePickerCell',
  props: {
    value: [String, Date],
  },
  computed: {
    localState: {
      get() {
        if (!this.value || !dayjs(this.value).isValid()) {
          return undefined
        }

        return (/^\d+$/.test(this.value) ? dayjs(+this.value) : dayjs(this.value)).format('YYYY-MM-DD')
      },
      set(val) {
        if (dayjs(val).isValid()) {
          this.$emit('input', val && dayjs(val).format('YYYY-MM-DD'))
        }
      },
    },
    date() {
      if (!this.value || this.localState) {
        return this.localState
      }
      return 'Invalid Date'
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      return $listeners
    },
  },
  mounted() {
    if (this.$el && this.$el.$el) {
      this.$el.$el.focus()
    }
  },
} */
</script>

<template>
  <!--  <v-menu> -->
  <!--    <template #activator="{ on }"> -->
  <input v-model="localState" type="date" class="value" />
  <!--    </template> -->
  <!--    <v-date-picker v-model="localState" flat @click.native.stop v-on="parentListeners" /> -->
  <!--  </v-menu> -->
</template>

<style scoped>
.value {
  width: 100%;
  min-height: 20px;
}
</style>
