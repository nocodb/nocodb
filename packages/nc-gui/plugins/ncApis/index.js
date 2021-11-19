import ApiFactory from '@/plugins/ncApis/apiFactory'

export default function({ store: $store, $axios, ...rest }, inject) {
  let instanceRefs = {}
  let projectId = null

  inject('ncApis', {
    get: ({ table, dbAlias = 'db', env = '_noco', type }) => {
      if (!$store.state.meta.metas[table]) {
        return
      }

      if (instanceRefs[env] && instanceRefs[env][dbAlias] && instanceRefs[env][dbAlias][table]) {
        return instanceRefs[env][dbAlias][table]
      }

      instanceRefs[env] = instanceRefs[env] || {}
      instanceRefs[env][dbAlias] = instanceRefs[env][dbAlias] || {}

      instanceRefs[env][dbAlias][table] = ApiFactory.create(
        table,
        type || $store.getters['project/GtrProjectType'],
        { $store, $axios, projectId, dbAlias, env, table }
      )

      return instanceRefs[env][dbAlias][table]
    },
    clear: () => {
      instanceRefs = {}
    },
    setProjectId: (_projectId) => {
      projectId = _projectId
    }
  })
}
