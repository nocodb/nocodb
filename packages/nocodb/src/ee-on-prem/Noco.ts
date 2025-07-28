import NocoEE from 'src/ee/Noco';

export default class Noco extends NocoEE {
  public static isOnPrem(): boolean {
    return true;
  }
}
