import type { Source } from '~/models';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';

export default async function canUseOptimisedQuery({
  source,
  disableOptimization,
}: {
  source: Source;
  disableOptimization: boolean;
}) {
  return (
    ((['mysql', 'mysql2'].includes(source.type) &&
      (await isMysqlVersionSupported(source))) ||
      ['pg'].includes(source.type)) &&
    !disableOptimization
  );
}
