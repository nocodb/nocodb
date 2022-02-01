<template>
  <div>
    <!--    <v-menu
      open-on-hover
      bottom
      offset-y
    >
      <template #activator="{on}">-->
    <v-btn
      v-if="_isUIAllowed('add-user')"
      outlined
      class="nc-btn-share-view caption px-2 nc-remove-border font-weight-medium"
      small
      text
      @click="$emit('share')"
    >
      <v-icon size="13" class="mr-1" color="#777">
        mdi-open-in-new
      </v-icon>
      <!-- Share View -->
      {{ $t('activity.shareView') }}
    </v-btn>
    <!--      </template>

      <v-list dense>
        <v-list-item
          dense
        >
          <v-list-item-title>
            <v-icon small class="mr-1">
              mdi-open-in-new
            </v-icon>
            <span class="caption">
              Share View
            </span>
          </v-list-item-title>
        </v-list-item>
        <v-list dense>
          <v-list-item
            dense
          >
            <v-list-item-title>
              <v-icon small class="mr-1">
                mdi-download-outline
              </v-icon>
              <span class="caption">
                Shared Views List
              </span>
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-list>
    </v-menu>-->
  </div>
</template>

<script>
export default {
  name: 'ShareViewMenu'
}
</script>

  <style scoped />
