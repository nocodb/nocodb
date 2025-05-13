{
  lib,
  dockerTools,
  callPackage,
  nginx,
  nginxModules,
  frontend,
}:
let
  nginxCustom = nginx.override {
    modules = lib.unique (nginx.modules ++ [ nginxModules.brotli ]);
  };
  nginxConf = callPackage ./confs/nginx.nix { inherit frontend; };

  init = callPackage ./init.nix {
    inherit nginxCustom;
    inherit nginxConf;
  };
in
dockerTools.buildLayeredImage {
  name = "nocodb-frontend";

  contents = [
    frontend
    nginxConf
  ];

  config = {
    WorkingDir = "/var/lib";

    ExposedPorts."80/tcp" = { };

    Entrypoint = [
      (lib.getExe init)
    ];
  };
}
