{
  lib,
  stdenv,
  nodePackages,
  pnpm,
  pulumi,
  sqlite,
  pkg-config,
  rsync,
  makeWrapper,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "nocodb";
  version = "0.260.2";
  src = ../.;

  patchPhase = ''
    # TODO: ./nodejs.nix, minor version mismatch
    sed -i '/use-node-version/d' ./.npmrc
  '';
  buildPhase = ''
    export NODE_OPTIONS="--max_old_space_size=16384"
    export NUXT_TELEMETRY_DISABLED=1
    export npm_config_nodedir=${nodePackages.nodejs}

    pnpm rebuild -r --verbose --reporter=append-only
    pnpm --filter=nocodb-sdk run build
    pnpm run registerIntegrations
    pnpm --filter=nc-gui run build:copy
    pnpm --filter=nocodb run docker:build
  '';

  installPhase = ''
    mkdir -p $out/share/nocodb/dist
    cp -v ./packages/nocodb/docker/main.js $out/share/nocodb/index.js

    # TODOD, only ship nocodb workspace prod deps with node_modules
    cp -r ./node_modules $out/share/nocodb/node_modules

    makeWrapper "${lib.getExe nodePackages.nodejs}" "$out/bin/${finalAttrs.pname}" \
      --add-flags "$out/share/nocodb/index.js"
  '';

  nativeBuildInputs = [
    nodePackages.pnpm
    pnpm.configHook

    rsync
    makeWrapper
    pkg-config
    (nodePackages.nodejs.python.withPackages (p: [
      p.distutils
    ]))
  ];

  buildInputs = [
    nodePackages.nodejs
    sqlite
    pulumi
  ];

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs) pname version src;
    hash = "sha256-X0LT8OaFbxaoWP8+cEDQtinnYLRLxGmO3cxk+JX5ztY=";
  };

  meta = {
    description = "Open Source Airtable Alternative";
    homepage = "https://nocodb.com/";
    platforms = lib.platforms.linux;
    license = lib.licenses.agpl3Plus;
    mainProgram = finalAttrs.pname;
    maintainers = with lib.maintainers; [ siannmohd ];
  };
})
