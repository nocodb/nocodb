import { MetaTable } from '../utils/globals';
import barcodeColumn from './barcodeColumn';
import base from './base';
import column from './column';
import disabledModelsForRoles from './disabledModelsForRoles';
import filter from './filter';
import form from './form';
import formColumn from './formColumn';
import formulaColumn from './formulaColumn';
import gallery from './gallery';
import galleryColumn from './galleryColumn';
import grid from './grid';
import gridColumn from './gridColumn';
import hook from './hook';
import hookLog from './hookLog';
import kanban from './kanban';
import kanbanColumn from './kanbanColumn';
import lookupColumn from './lookupColumn';
import ltarColumn from './ltarColumn';
import map from './map';
import mapColumn from './mapColumn';
import model from './model';
import plugin from './plugin';
import project from './project';
import projectUser from './projectUser';
import qrCodeColumn from './qrCodeColumn';
import rollupColumn from './rollupColumn';
import selectOptionColumn from './selectOptionColumn';
import sharedView from './sharedView';
import sort from './sort';
import store from './store';
import syncLog from './syncLog';
import syncSource from './syncSource';
import user from './user';
import view from './view';

type ModelValidationObjType = {
  [key in MetaTable]?: {
    create?: any;
    update?: any;
  };
};

export const modelSchema: ModelValidationObjType = {
  [MetaTable.PROJECT]: project,
  [MetaTable.BASES]: base,
  [MetaTable.MODELS]: model,
  [MetaTable.VIEWS]: view,
  [MetaTable.GRID_VIEW]: grid,
  [MetaTable.GRID_VIEW_COLUMNS]: gridColumn,
  [MetaTable.FORM_VIEW]: form,
  [MetaTable.FORM_VIEW_COLUMNS]: formColumn,
  [MetaTable.KANBAN_VIEW]: kanban,
  [MetaTable.KANBAN_VIEW_COLUMNS]: kanbanColumn,
  [MetaTable.MAP_VIEW]: map,
  [MetaTable.MAP_VIEW_COLUMNS]: mapColumn,
  [MetaTable.GALLERY_VIEW]: gallery,
  [MetaTable.GALLERY_VIEW_COLUMNS]: galleryColumn,
  [MetaTable.COLUMNS]: column,
  [MetaTable.COL_LOOKUP]: lookupColumn,
  [MetaTable.COL_BARCODE]: barcodeColumn,
  [MetaTable.COL_QRCODE]: qrCodeColumn,
  [MetaTable.COL_FORMULA]: formulaColumn,
  [MetaTable.COL_ROLLUP]: rollupColumn,
  [MetaTable.COL_RELATIONS]: ltarColumn,
  [MetaTable.COL_SELECT_OPTIONS]: selectOptionColumn,
  [MetaTable.FILTER_EXP]: filter,
  [MetaTable.SORT]: sort,
  [MetaTable.HOOKS]: hook,
  [MetaTable.HOOK_LOGS]: hookLog,
  [MetaTable.SHARED_VIEWS]: sharedView,
  [MetaTable.MODEL_ROLE_VISIBILITY]: disabledModelsForRoles,
  [MetaTable.PLUGIN]: plugin,
  [MetaTable.PROJECT_USERS]: projectUser,
  [MetaTable.USERS]: user,
  [MetaTable.STORE]: store,
  [MetaTable.SYNC_SOURCE]: syncSource,
  [MetaTable.SYNC_LOGS]: syncLog,
};
