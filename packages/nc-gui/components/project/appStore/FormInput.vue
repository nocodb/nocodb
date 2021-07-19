<template>
  <text-area-cell
    v-if="inputDetails.type === 'LongText'"
    v-model="localState"
    :input-details="inputDetails"
  />
  <password-field
    v-else-if="inputDetails.type === 'Password'"
    v-model="localState"
    :input-details="inputDetails"
  />
  <attachment
    v-else-if="inputDetails.type === 'Attachment'"
    v-model="localState"
    :input-details="inputDetails"
  />
  <text-field v-else v-model="localState" :input-details="inputDetails" />
</template>

<script>
import TextField from '@/components/project/appStore/inputs/textField'
import Attachment from '@/components/project/appStore/inputs/attachment'
import PasswordField from '@/components/project/appStore/inputs/passwordField'
import TextAreaCell from '~/components/project/spreadsheet/components/editableCell/textAreaCell'

export default {
  name: 'FormInput',
  components: { PasswordField, TextAreaCell, Attachment, TextField },
  props: {
    value: String,
    inputDetails: Object
  },
  computed: {
    localState: {
      get () {
        return this.value
      },
      set (val) {
        this.$emit('input', val)
      }
    }
  }
}
</script>

<style scoped>
</style>
