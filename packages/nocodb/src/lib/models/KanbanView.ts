import Noco from '../noco/Noco';
import { MetaTable } from '../utils/globals';

export default class KanbanView {
  title: string;
  show: boolean;
  is_default: boolean;
  order: number;

  fk_view_id: string;

  constructor(data: KanbanView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    const view = await ncMeta.metaGet2(null, null, MetaTable.KANBAN_VIEW, {
      fk_view_id: viewId
    });

    return view && new KanbanView(view);
  }
}
