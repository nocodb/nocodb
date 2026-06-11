export const arrayToNested = ({
  data,
  getIdHandler,
  getFkHandler,
  childAssignHandler,
  parentFkId,
  level = 0,
  maxLevel = 5,
}: {
  data: any[];
  getIdHandler: (any) => string | null | undefined;
  getFkHandler: (any) => string | null | undefined;
  childAssignHandler: (row, children) => void;
  parentFkId?: string;
  level?: number;
  maxLevel?: number;
}) => {
  let recordsOnLevel;
  if (level === 0) {
    recordsOnLevel = data.filter((row) => !getFkHandler(row));
  } else {
    recordsOnLevel = data.filter((row) => getFkHandler(row) === parentFkId);
  }
  if (level < maxLevel) {
    for (const row of recordsOnLevel) {
      childAssignHandler(
        row,
        arrayToNested({
          data,
          getIdHandler,
          parentFkId: getIdHandler(row),
          childAssignHandler,
          getFkHandler,
          level: level + 1,
          maxLevel,
        })
      );
    }
  }
  return recordsOnLevel;
};

export const traverseNested = <T>(params: {
  nestedData: T[];
  getChildField: (row: T) => T[];
  onEach: (each: T) => void;
}) => {
  for (const each of params.nestedData) {
    params.onEach(each);
    traverseNested({
      nestedData: params.getChildField(each),
      getChildField: params.getChildField,
      onEach: params.onEach,
    });
  }
};
