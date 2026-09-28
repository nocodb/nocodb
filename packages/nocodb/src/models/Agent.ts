/**
 * CE stub. Agents are an EE feature; `src/ee/models/Agent.ts` is the real
 * model. This exists so shared code on the record-write and file-import paths
 * can ask about agent triggers without an edition check — mirroring the
 * `Workflow` stub beside it.
 */
export default class Agent {
  constructor(_agent: any) {
    Object.assign(this, _agent);
  }

  public static async get(..._args: any) {
    return null;
  }

  public static async list(..._args: any) {
    return [];
  }

  public static async findByTrigger(..._args: any) {
    return [];
  }

  public static async hasRecordInsertTriggers(..._args: any) {
    return false;
  }
}
