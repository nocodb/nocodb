<template>

  <v-select
    class="caption"
    outlined
    dense
    v-model="hookEvent"
    label="Event"
    required
    :items="eventList"
    :item-text="v => v.text.join(' ')"
    :item-value="v => v.value.join(' ')"
    :rules="[v => !!v || 'Event Required']"
  >
  </v-select>
</template>

<script>
export default {
  name: "webhookEvent",
  props: ['operation', 'event'],
  data: () => ({
    eventList: [
      // {text: ["Before", "Insert"], value: ['before', 'insert']},
      {text: ["After", "Insert"], value: ['after', 'insert']},
      // {text: ["Before", "Update"], value: ['before', 'update']},
      {text: ["After", "Update"], value: ['after', 'update']},
      // {text: ["Before", "Delete"], value: ['before', 'delete']},
      {text: ["After", "Delete"], value: ['after', 'delete']},
    ],
  }),
  computed: {
    hookEvent: {
      get() {
        return `${this.event} ${this.operation}`
      }, set(v) {
        const [event, operation] = v.split(' ');
        this.$emit('update:event', event);
        this.$emit('update:operation', operation);
      }
    }
  }
}
</script>

<style scoped>

</style>
