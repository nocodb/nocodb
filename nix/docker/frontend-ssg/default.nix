{
  lib,
  dockerTools,
  callPackage,
  nginx,
  nginxModules,
  frontend-ssg,
}:
let
  nginxCustom = nginx.override {
    modules = lib.unique (nginx.modules ++ [ nginxModules.brotli ]);
  };
  nginxConf = callPackage ./confs/nginx.nix { frontend = frontend-ssg; };

  init = callPackage ./init.nix {
    inherit nginxCustom;
    inherit nginxConf;
  };
in
dockerTools.buildLayeredImage {
  name = "nocodb-frontend-ssg";

  contents = [
    frontend-ssg
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
