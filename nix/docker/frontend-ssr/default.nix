{
  lib,
  dockerTools,
  dumb-init,
  frontend-ssr,
}:
let
  port = 80;
in
dockerTools.buildLayeredImage {
  name = "nocodb-frontend-ssr";

  config = {
    Env = [
      "PORT=${builtins.toString port}"
    ];
    ExposedPorts = {
      "${builtins.toString port}/tcp" = { };
    };

    Entrypoint = [
      (lib.getExe dumb-init)
      "--"
      (lib.getExe frontend-ssr)
    ];
  };
}
