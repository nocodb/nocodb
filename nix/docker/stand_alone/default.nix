{
  lib,
  dockerTools,
  nocodb,
}:
let
  port = 80;
in
dockerTools.buildLayeredImage {
  name = "nocodb";
  contents = [ dockerTools.binSh ];

  config = {
    WorkingDir = "/var/lib/nocodb";

    Env = [
      "PORT=${builtins.toString port}"
    ];
    ExposedPorts = {
      "${builtins.toString port}/tcp" = { };
    };

    Entrypoint = [
      (lib.getExe nocodb)
    ];
  };
}
