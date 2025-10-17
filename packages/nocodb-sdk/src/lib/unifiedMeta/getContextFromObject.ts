import { NcContext } from '~/lib/ncTypes';

export const getContextFromObject = (obj: {
  base_id: string;
  fk_workspace_id?: string;
}) => {
  if (!obj) {
    return undefined;
  }
  return <NcContext>{
    base_id: obj.base_id,
    workspace_id: obj.fk_workspace_id,
  };
};
