{
  lib,
  dockerTools,
  dumb-init,
  backend,
}:
let
  port = 80;
in
dockerTools.buildLayeredImage {
  name = "nocodb-backend";
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
      (lib.getExe dumb-init)
      "--"
      (lib.getExe backend)
    ];
  };
}
