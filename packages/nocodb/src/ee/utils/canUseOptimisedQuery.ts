import type { Base } from '~/models';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';

export default async function canUseOptimisedQuery({
  base,
  disableOptimization,
}: {
  base: Base;
  disableOptimization: boolean;
}) {
  return (
    ((['mysql', 'mysql2'].includes(base.type) &&
      (await isMysqlVersionSupported(base))) ||
      ['pg'].includes(base.type)) &&
    !disableOptimization
  );
}
