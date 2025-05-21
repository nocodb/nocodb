<script lang="ts" setup>
const route = useRoute()

interface BreadcrumbType {
  title: string
  active?: boolean
  path?: string
}

const { t } = useI18n()

const breadcrumb = computed<BreadcrumbType[]>(() => {
  const payload: BreadcrumbType[] = [
    {
      title: 'Account',
    },
  ]

  switch (route.params.page) {
    case 'profile': {
      payload.push({
        title: t('labels.profile'),
        active: true,
      })
      break
    }
    case 'tokens': {
      payload.push({
        title: t('title.tokens'),
        active: true,
      })
      break
    }
    case 'audit': {
      payload.push({
        title: t('title.auditLogs'),
        active: true,
      })
      break
    }
    case 'apps': {
      payload.push({
        title: t('title.appStore'),
        active: true,
      })
      break
    }
  }

  switch (route.params.nestedPage) {
    case 'password-reset': {
      payload.push(
        ...[
          {
            title: t('objects.users'),
          },
          {
            title: t('title.resetPasswordMenu'),
            active: true,
          },
        ],
      )
      break
    }
    case 'settings': {
      payload.push(
        ...[
          {
            title: t('objects.users'),
          },
          {
            title: t('activity.settings'),
            active: true,
          },
        ],
      )
      break
    }
  }

  if (route.path.startsWith('/account/setup')) {
    payload.push({
      title: t('labels.setup'),
      active: !route.params.nestedPage,
      path: '/account/setup',
    })

    if (route.params.nestedPage) {
      payload.push({
        title: route.params.nestedPage,
        active: !route.params.app,
        path: `/account/setup/${route.params.nestedPage}`,
      })
    }

    if (route.params.app) {
      payload.push({
        title: route.params.app,
        active: true,
      })
    }
  } else if ((route.params.page === undefined && route.params.nestedPage === '') || route.params.nestedPage === 'list') {
    payload.push(
      ...[
        {
          title: t('objects.users'),
        },
        {
          title: t('title.userManagement'),
          active: true,
        },
      ],
    )
  }

  return payload
})

const onClick = async (item: BreadcrumbType) => {
  if (item.path && !item.active) {
    await navigateTo(item.path)
  }
}
</script>

<template>
  <div class="nc-breadcrumb">
    <template v-for="(item, i) of breadcrumb" :key="i">
      <div
        class="nc-breadcrumb-item capitalize"
        :class="{
          'active': item.active,
          'cursor-pointer': item.path && !item.active,
        }"
        @click="onClick(item)"
      >
        {{ item.title }}
      </div>
      <GeneralIcon v-if="i !== breadcrumb.length - 1" icon="ncSlash1" class="nc-breadcrumb-divider" />
    </template>
  </div>
</template>
