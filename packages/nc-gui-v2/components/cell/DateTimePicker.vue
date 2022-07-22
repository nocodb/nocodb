<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref, useProject } from '#imports'

interface Props {
  modelValue?: string
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useProject()
const showMessage = ref(false)

const localState = computed({
  get() {
    if (!modelValue) {
      return modelValue
    }
    const d = /^\d+$/.test(modelValue) ? dayjs(+modelValue) : dayjs(modelValue)
    if (d.isValid()) {
      showMessage.value = false
      return d.format('YYYY-MM-DD HH:mm')
    } else {
      showMessage.value = true
    }
  },
  set(value?: string) {
    if (isMysql) {
      emit('update:modelValue', value && dayjs(value).format('YYYY-MM-DD HH:mm:ss'))
    } else {
      emit('update:modelValue', value && dayjs(value).format('YYYY-MM-DD HH:mm:ssZ'))
    }
  },
})

/* import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export default {
  name: 'DateTimePickerCell',
  props: {
    value: [String, Date, Number],
    ignoreFocus: Boolean,
  },
  data: () => ({
    showMessage: false,
  }),
  computed: {
    isMysql() {
      return ['mysql', 'mysql2'].indexOf(this.$store.getters['project/GtrClientType'])
    },
    localState: {
      get() {
        if (!this.value) {
          return this.value
        }
        const d = /^\d+$/.test(this.value) ? dayjs(+this.value) : dayjs(this.value)
        if (d.isValid()) {
          this.showMessage = false
          return d.format('YYYY-MM-DD HH:mm')
        } else {
          this.showMessage = true
        }
      },
      set(value) {
        if (this.isMysql) {
          this.$emit('input', value && dayjs(value).format('YYYY-MM-DD HH:mm:ss'))
        } else {
          this.$emit('input', value && dayjs(value).format('YYYY-MM-DD HH:mm:ssZ'))
        }
      },
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        // $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      return $listeners
    },
  },
  mounted() {
    // listen dialog click:outside event and save on close
    if (this.$refs.picker && this.$refs.picker.$children && this.$refs.picker.$children[0]) {
      this.$refs.picker.$children[0].$on('click:outside', () => {
        this.$refs.picker.okHandler()
      })
    }

    if (!this.ignoreFocus) {
      this.$refs.picker.display = true
    }
  },
} */
</script>

<template>
  <input v-model="localState" type="datetime-local" />
  <!--  <div> -->
  <!--    <div v-show="!showMessage"> -->
  <!--      <v-datetime-picker -->
  <!--        ref="picker" -->
  <!--        v-model="localState" -->
  <!--        class="caption xc-date-time-picker" -->
  <!--        :text-field-props="{ -->
  <!--          class: 'caption mt-0 pt-0', -->
  <!--          flat: true, -->
  <!--          solo: true, -->
  <!--          dense: true, -->
  <!--          hideDetails: true, -->
  <!--        }" -->
  <!--        :time-picker-props="{ -->
  <!--          format: '24hr', -->
  <!--        }" -->
  <!--        v-on="parentListeners" -->
  <!--      /> -->
  <!--    </div> -->
  <!--    <div v-show="showMessage" class="edit-warning" @dblclick="$refs.picker.display = true"> -->
  <!--      &lt;!&ndash; TODO: i18n &ndash;&gt; -->
  <!--      ERR: Couldn't parse {{ value }} -->
  <!--    </div> -->
  <!--  </div> -->
</template>

<style scoped>
/*:deep(.v-input),*/
/*:deep(.v-text-field) {*/
/*  margin-top: 0 !important;*/
/*  padding-top: 0 !important;*/
/*  font-size: inherit !important;*/
/*}*/

/*.edit-warning {*/
/*  padding: 10px;*/
/*  text-align: left;*/
/*  color: #e65100;*/
/*}*/
</style>
