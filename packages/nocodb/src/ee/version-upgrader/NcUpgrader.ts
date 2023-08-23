import NcUpgraderCE from 'src/version-upgrader/NcUpgrader';
import type { NcUpgraderCtx } from 'src/version-upgrader/NcUpgrader';

export default class NcUpgrader extends NcUpgraderCE {
  protected static getUpgraderList(): {
    name: string;
    handler: (ctx?: NcUpgraderCtx) => Promise<void> | void;
  }[] {
    return (
      [
        ...NcUpgraderCE.getUpgraderList(),
        // add new upgrader specific to EE here as follows
        // { name: '0108003', handler: ncMinimalDbUpgrader },
      ]
        // order based on version(name)
        .sort((a, b) => +a.name - +b.name)
    );
  }
}

export * from 'src/version-upgrader/NcUpgrader';
