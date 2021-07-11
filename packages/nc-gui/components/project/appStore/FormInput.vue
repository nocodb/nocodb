<template>
  <text-area-cell v-if="inputDetails.type === 'LongText'" :input-details="inputDetails"
                   v-model="localState"></text-area-cell>
  <password-field v-else-if="inputDetails.type === 'Password'"
                  :input-details="inputDetails" v-model="localState"></password-field>
  <attachment
    v-else-if="inputDetails.type === 'Attachment'"
    :input-details="inputDetails"
    v-model="localState"></attachment>
  <text-field v-else :input-details="inputDetails" v-model="localState"></text-field>
</template>

<script>
import TextField from "@/components/project/appStore/inputs/textField";
import EditableAttachmentCell from "@/components/project/spreadsheet/components/editableCell/editableAttachmentCell";
import Attachment from "@/components/project/appStore/inputs/attachment";
import TextAreaCell from "~/components/project/spreadsheet/components/editableCell/textAreaCell";
import PasswordField from "@/components/project/appStore/inputs/passwordField";

export default {
  name: "FormInput",
  components: {PasswordField, TextAreaCell, Attachment, EditableAttachmentCell, TextField},
  props: {
    value: String,
    inputDetails: Object
  },
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val);
      }
    },
  }
}
</script>

<style scoped>
</style>
