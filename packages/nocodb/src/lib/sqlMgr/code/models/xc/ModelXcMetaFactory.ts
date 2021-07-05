import ModelXcMetaMysql from "./ModelXcMetaMysql";
import ModelXcMetaSqlite from "./ModelXcMetaSqlite";
import ModelXcMetaPg from "./ModelXcMetaPg";
import ModelXcMetaMssql from "./ModelXcMetaMssql";
import ModelXcMetaOracle from "./ModelXcMetaOracle";
import BaseModelXcMeta from "./BaseModelXcMeta";

class ModelXcMetaFactory {
  public static create(connectionConfig, args):BaseModelXcMeta {
    if (connectionConfig.client === "mysql2" || connectionConfig.client === "mysql") {
      return new ModelXcMetaMysql(args)
    } else if (connectionConfig.client === "sqlite3") {
      return new ModelXcMetaSqlite(args)
    } else if (connectionConfig.client === "mssql") {
      return new ModelXcMetaMssql(args);
    } else if (connectionConfig.client === "pg") {
      return new ModelXcMetaPg(args);
    } else if (connectionConfig.client === "oracledb") {
      return new ModelXcMetaOracle(args);
    }

    throw new Error("Database not supported");
  }
}

export default ModelXcMetaFactory;
