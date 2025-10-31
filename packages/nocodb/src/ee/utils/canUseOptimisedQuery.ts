import type { Source } from '~/models';
import type { NcContext } from '~/interface/config';
// import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';

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
    // disable mysql single query for now until we fix performance issues related to the mysql
    // (['mysql', 'mysql2'].includes(source.type) &&
    // (await isMysqlVersionSupported(context, source))) ||
    ['pg'].includes(source.type) && !disableOptimization
  );
}
