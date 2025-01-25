inputs:
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.nocodb;
  inherit (pkgs.stdenv.hostPlatform) system;

  defaultEnvs = {
    DATABASE_URL="sqlite:///%S/nocodb/sqlite.db";
  };
in
{
  meta.maintainers = with lib.maintainers; [ sinanmohd ];

  options.services.nocodb = {
    enable = lib.mkEnableOption "nocodb";
    package = lib.mkOption {
      type = lib.types.package;
      description = "The nocodb package to use.";
      default = inputs.self.packages.${system}.nocodb;
    };

    environment = lib.mkOption {
      default = { };
      type = lib.types.attrsOf lib.types.str;
    };
    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      example = "/var/lib/nocodb/secrets";
      default = null;
    };
  };

  config = lib.mkIf cfg.enable {
    environment.systemPackages = [ cfg.package ];

    systemd.services.nocodb = {
      description = "Open Source Airtable Alternative";
      wantedBy = [ "multi-user.target" ];
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      environment = defaultEnvs // cfg.environment;

      serviceConfig = {
        Type = "simple";
        DynamicUser = true;
        StateDirectory = "nocodb";
        Restart = "on-failure";
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;
        ExecStart = lib.getExe cfg.package;
      };
    };
  };
}
