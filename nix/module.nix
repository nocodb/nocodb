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
    DATABASE_URL = "sqlite:///%S/nocodb/sqlite.db";
    PORT = builtins.toString cfg.port;
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

    port = lib.mkOption {
      type = lib.types.port;
      default = 8080;
      description = "The port nocodb should be reachable from.";
    };
    environment = lib.mkOption {
      default = { };
      type = lib.types.attrsOf lib.types.str;
      description = ''
        Environment variables as defined in https://docs.nocodb.com/getting-started/self-hosted/environment-variables/.
      '';
    };
    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      example = "/var/lib/nocodb/secrets";
      default = null;
      description = ''
        Environment variables as defined in https://docs.nocodb.com/getting-started/self-hosted/environment-variables/.
        Secrets may be passed to the service without adding them to the world-readable Nix store using this option.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    environment.systemPackages = [ cfg.package ];

    systemd.services.nocodb = {
      description = "NocoDB allows building no-code database solutions with ease of spreadsheets";
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
