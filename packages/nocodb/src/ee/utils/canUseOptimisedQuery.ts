import {Base} from "~/models";

export default function canUseOptimisedQuery({
  base,
  disableOptimization,
}: {
  base: Base;
  disableOptimization: boolean;
}) {
  return ['pg', 'mysql', 'mysql2'].includes(base.type) && !disableOptimization;
}
