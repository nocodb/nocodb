import NcUpgraderCE from 'src/version-upgrader/NcUpgrader';
import ncMinimalDbUpgrader from './ncMinimalDbUpgrader';
import type { NcUpgraderCtx } from 'src/version-upgrader/NcUpgrader';

export default class NcUpgrader extends NcUpgraderCE {
  protected static getUpgraderList(): {
    name: string;
    handler: (ctx?: NcUpgraderCtx) => Promise<void> | void;
  }[] {
    return (
      [
        ...NcUpgraderCE.getUpgraderList(),
        { name: '0108003', handler: ncMinimalDbUpgrader },
      ]
        // order based on version(name)
        .sort((a, b) => +a.name - +b.name)
    );
  }
}


export * from 'src/version-upgrader/NcUpgrader';
