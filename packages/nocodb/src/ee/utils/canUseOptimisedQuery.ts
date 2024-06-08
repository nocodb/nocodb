import type { Source } from '~/models';
import type { NcContext } from '~/interface/config';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';

export default async function canUseOptimisedQuery(
  context: NcContext,
  {
    source,
    disableOptimization,
  }: {
    source: Source;
    disableOptimization: boolean;
  },
) {
  return (
    ((['mysql', 'mysql2'].includes(source.type) &&
      (await isMysqlVersionSupported(context, source))) ||
      ['pg'].includes(source.type)) &&
    !disableOptimization
  );
}
