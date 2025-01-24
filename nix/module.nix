{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.nocodb;
in
{
  meta.maintainers = with lib.maintainers; [ sinanmohd ];

  options.services.nocodb = {
    enable = lib.mkEnableOption "nocodb";
    package = lib.mkOption {
      type = lib.types.package;
      description = "The nocodb package to use.";
      default = pkgs.callPackage ./package.nix { };
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
      inherit (cfg) environment;

      serviceConfig = {
        Type = "simple";
        DynamicUser = true;

        RuntimeDirectory = "nocodb";
        StateDirectory = "nocodb";
        RuntimeDirectoryMode = "0700";

        Restart = "on-failure";

        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;

        ExecStart = lib.getExe cfg.package;
      };
    };
  };
}
