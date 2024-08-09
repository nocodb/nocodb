import Noco from '~/Noco';

export default async function (_force = false, _ncMeta = Noco.ncMeta) {
  return {
    impacted: 0,
    cloud: true,
    projectsMeta: 0,
    projectsExt: 0,
    nc_db_type: null,
    created: null,
  };
}
