abstract class XcPluginMigration {
  public abstract up(): Promise<any>;

  public abstract down(): Promise<any>;
}

export default XcPluginMigration;
