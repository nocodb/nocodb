<template>
  <v-container fluid>

    <kanban-board :stages="stages" :blocks="blocks" @update-block="updateBlock">
      <div v-for="(stage,i) in stages" :slot="stage" :key="stage" class="mx-auto">
        <v-chip :color="stagesColors[i]" class="text-uppercase caption font-weight-bold">{{ stage }}</v-chip>
      </div>
      <div v-for="block in blocks" :slot="block.id" :key="block.id" class="caption">
        <!--        <div>-->
        <!--          {{ block.id }}-->
        <!--        </div>-->
        <div>
          {{ block.title }}
        </div>
      </div>
    </kanban-board>
  </v-container>
</template>

<script>

// import "vue-kanban/src/assets/kanban.css";

export default {
  name: "kanbanView",
  data: () => ({
    stages: ['on-hold', 'in-progress', 'needs-review', 'approved'],
    stagesColors: ['error', 'primary', 'warning', 'success'],
    blocks: [
      {
        id: 1,
        status: 'on-hold',
        title: 'More language options',
      },
      {
        id: 2,
        status: 'on-hold',
        title: 'Customizable links',
      },
      {
        id: 3,
        status: 'on-hold',
        title: 'Emoji support',
      },
      {
        id: 4,
        status: 'on-hold',
        title: 'Video embedding',
      },
      {
        id: 5,
        status: 'on-hold',
        title: 'Photo gallery support',
      },
      {
        id: 6,
        status: 'on-hold',
        title: 'Starred cards',
      },
      {
        id: 7,
        status: 'in-progress',
        title: 'Reporting',
      },
      {
        id: 8,
        status: 'in-progress',
        title: 'Marks card as done',
      },
      {
        id: 9,
        status: 'in-progress',
        title: 'Multiple due dates',
      },
      {
        id: 10,
        status: 'in-progress',
        title: 'Expand notifications',
      },
      {
        id: 11,
        status: 'needs-review',
        title: '"Heart" commad',
      },
      {
        id: 12,
        status: 'needs-review',
        title: 'Assign checklist item',
      },
      {
        id: 13,
        status: 'approved',
        title: 'Delete permissions',
      },
      {
        id: 14,
        status: 'approved',
        title: '3rd party calendar support',
      },
      {
        id: 15,
        status: 'approved',
        title: '2FA',
      },
      {
        id: 16,
        status: 'approved',
        title: 'Additional sticker packs',
      },

    ],
  })
}
</script>

<style scoped lang="scss">
::v-deep {

  ul.drag-list, ul.drag-inner-list {
    list-style-type: none;
    margin: 0;
    padding: 0;
  }

  .drag-container {
    max-width: 1000px;
    margin: 20px auto;
  }

  .drag-list {
    display: flex;
    align-items: flex-start;
  }

  @media (max-width: 690px) {
    .drag-list {
      display: block;
    }
  }

  .drag-column {
    flex: 1;
    margin: 0 10px;
    position: relative;
    background: var(--v-backgroundColor-base); //rgba(256, 256, 256, 0.2);
    overflow: hidden;
    border-radius: 4px;
  }

  @media (max-width: 690px) {
    .drag-column {
      margin-bottom: 30px;
    }
  }

  .drag-column h2 {
    font-size: 0.8rem;
    margin: 0;
    text-transform: uppercase;
    font-weight: 600;
  }

  .drag-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
  }

  .drag-inner-list {
    min-height: 20px;
    //color: white;
  }

  .drag-item {
    padding: 10px;
    margin: 10px;
    //height: 100px;
    background: var(--v-backgroundColor-lighten2);
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    border-radius: 4px;
  }

  .drag-item.is-moving {
    transform: scale(1.1);
    background: var(--v-backgroundColor-darken1);
  }

  .drag-header-more {
    cursor: pointer;
  }

  .drag-options {
    position: absolute;
    top: 44px;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 10px;
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .drag-options.active {
    transform: translateX(0);
    opacity: 1;
  }

  .drag-options-label {
    display: block;
    margin: 0 0 5px 0;
  }

  .drag-options-label input {
    opacity: 0.6;
  }

  .drag-options-label span {
    display: inline-block;
    font-size: 0.9rem;
    font-weight: 400;
    margin-left: 5px;
  }

  /* Dragula CSS  */
  .gu-mirror {
    position: fixed !important;
    margin: 0 !important;
    z-index: 9999 !important;
    opacity: 0.8;
    list-style-type: none;
  }

  .gu-hide {
    display: none !important;
  }

  .gu-unselectable {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
  }

  .gu-transit {
    opacity: 0.2;
  }

}
</style>
