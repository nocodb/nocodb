import { CURRENT_USER_TOKEN, UITypes } from 'nocodb-sdk';
import { isFilterValueConsistOf } from 'src/helpers/dbHelpers';
import type Column from 'src/models/Column';
import type Filter from 'src/models/Filter';
import type { NcContext } from 'nocodb-sdk';

export const handleCurrentUserFilter = (
  context: NcContext,
  param: {
    column: Column;
    filter: Filter;
    setVal: (val: string) => void;
  },
) => {
  const { column, filter, setVal } = param;
  if (
    [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
      column.uidt,
    )
  ) {
    const filterValueCurrentUserTokenResult = isFilterValueConsistOf(
      filter.value,
      CURRENT_USER_TOKEN,
      {
        replace: context.user?.id ?? '___false',
      },
    );
    if (filterValueCurrentUserTokenResult?.exists) {
      setVal(filterValueCurrentUserTokenResult.value);
    }
  }
};
