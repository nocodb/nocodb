import type { BaseModelSql } from '../../db/sql-data-mapper';

export const m2mNotChildren = ({
  models = {},
}: {
  models: { [key: string]: BaseModelSql };
}) => {
  return async (args) => {
    return models[args?.parent]?.m2mNotChildren(args);
  };
};
export const m2mNotChildrenCount = ({
  models = {},
}: {
  models: { [key: string]: BaseModelSql };
}) => {
  return async (args) => {
    return models[args?.parent]?.m2mNotChildrenCount(args);
  };
};
