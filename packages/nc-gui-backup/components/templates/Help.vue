<template>
  <v-dialog v-model="localState" max-width="900">
    <v-card>
      <v-card-title> Shortcuts </v-card-title>
      <v-card-text>
        <v-simple-table v-slot dense>
          <thead>
            <tr>
              <th></th>
              <th class="pa-2">Mac OS</th>
              <th class="pa-2">Windows / Linux</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(short, i) in shortcuts" :key="i">
              <td class="caption">{{ short.description }}</td>
              <td class="caption pa-2" v-html="short.mac"></td>
              <td class="caption pa-2" v-html="short.windows"></td>
            </tr>
          </tbody>
        </v-simple-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'Help',
  props: {
    value: Boolean,
  },
  data() {
    return {
      shortcuts: [
        {
          description: 'Add tables',
          mac: '<kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>T</kbd>',
          windows: '<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd>',
        },
        {
          description: 'Add columns',
          mac: '<kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>C</kbd>',
          windows: '<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>',
        },
        {
          description: 'Add new column row',
          mac: '<kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>A</kbd>',
          windows: '<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd>',
        },
        {
          description: 'Table navigation',
          mac: '<kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>Arrow Down</kbd> <br>AND<br> <kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>Arrow Up</kbd>',
          windows:
            '<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Arrow Down</kbd> <br>AND<br> <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Arrow Up</kbd>',
        },
        {
          description: 'Column navigation',
          mac: '<kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>Arrow Right</kbd> <br>AND<br> <kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>Arrow Left</kbd>',
          windows:
            '<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Arrow Right</kbd> <br>AND<br> <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Arrow Right</kbd>',
        },
        {
          description: 'Copy json to clipboard',
          mac: '<kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>J</kbd>',
          windows: '<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd>',
        },
        {
          description: 'Submit template',
          mac: '<kbd>Command</kbd> + <kbd>Control</kbd> + <kbd>S</kbd>',
          windows: '<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>',
        },
      ],
    };
  },
  computed: {
    localState: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
  },
};
</script>

<style scoped></style>
