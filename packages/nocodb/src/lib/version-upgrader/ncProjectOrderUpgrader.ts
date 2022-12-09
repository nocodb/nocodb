import { MetaTable } from '../utils/globals'
import { NcUpgraderCtx } from './NcUpgrader'

/** Upgrader for upgrading roles */
export default async function({ ncMeta }: NcUpgraderCtx) {
  const projects = await ncMeta.metaList2(null, null, MetaTable.PROJECT)

  let order = 0;
  for (const project of projects) {
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT,
      {
      order: ++order,
    }, project.id)
  }
}
