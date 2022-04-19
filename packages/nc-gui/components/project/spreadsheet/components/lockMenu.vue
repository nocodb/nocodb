<template>
  <v-menu offset-y max-width="350">
    <template #activator="{on}">
      <v-icon v-if="value === 'locked'" small class="mx-1 nc-view-lock-menu" v-on="on">
        mdi-lock-outline
      </v-icon>
      <v-icon v-else-if="value === 'personal'" small class="mx-1 nc-view-lock-menu" v-on="on">
        mdi-account
      </v-icon>
      <v-icon v-else small class="mx-1 nc-view-lock-menu" v-on="on">
        mdi-account-group-outline
      </v-icon>
    </template>
    <v-list maxc-width="350">
      <v-list-item two-line class="pb-4" @click="changeLockType('collaborative')">
        <v-list-item-icon class="mr-1 align-self-center">
          <v-icon v-if="!value || value === 'collaborative'" small>
            mdi-check-bold
          </v-icon>
        </v-list-item-icon>
        <v-list-item-content class="pb-1">
          <v-list-item-title>
            <v-icon small class="mt-n1" color="primary">
              mdi-account-group
            </v-icon>
            Collaborative view
          </v-list-item-title>

          <v-list-item-subtitle class="pt-2 pl- font-weight-light" style="white-space: normal">
            Collaborators with edit permissions or higher can change the view configuration.
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item two-line class="pb-4" @click="changeLockType('locked')">
        <v-list-item-icon class="mr-1 align-self-center">
          <v-icon v-if="value === 'locked'" small>
            mdi-check-bold
          </v-icon>
        </v-list-item-icon>

        <v-list-item-content class="pb-1">
          <v-list-item-title>
            <v-icon small class="mt-n1" color="primary">
              mdi-lock
            </v-icon>
            Locked View
          </v-list-item-title>

          <v-list-item-subtitle class="pt-2 pl- font-weight-light" style="white-space: normal">
            No one can edit the view configuration until it is unlocked.
          </v-list-item-subtitle>
          <span class="caption mt-3"><v-icon class="mr-1 mt-n1" x-small color="#fcb401"> mdi-star</v-icon>Locked view.</span>
        </v-list-item-content>
      </v-list-item>
      <v-list-item three-line @click="changeLockType('personal')">
        <v-list-item-icon class="mr-1 align-self-center">
          <v-icon v-if="value === 'personal'" small>
            mdi-check-bold
          </v-icon>
        </v-list-item-icon>

        <v-list-item-content>
          <v-list-item-title>
            <v-icon small class="mt-n1" color="primary">
              mdi-account
            </v-icon>
            Personal view
          </v-list-item-title>

          <v-list-item-subtitle class="pt-2 pl- font-weight-light" style="white-space: normal">
            Only you can edit the view configuration. Other collaborators’ personal views are hidden by default.
          </v-list-item-subtitle>
          <span class="caption mt-3"><v-icon class="mr-1 mt-n1" x-small color="#fcb401"> mdi-star</v-icon>Coming soon.</span>
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
export default {
  name: 'LockMenu',
  props: ['value'],
  data: () => ({

  }),
  methods: {
    changeLockType(type) {
      this.$tele.emit(`lockmenu:${type}`)
      if (type === 'personal') {
        return this.$toast.info('Coming soon').goAway(3000)
      }
      this.$emit('input', type)
      this.$toast.success(`Successfully Switched to ${type} view`).goAway(3000)
    }
  }
}
</script>

<style scoped>

</style>
