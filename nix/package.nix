{
  lib,
  stdenv,
  nodePackages,
  pnpm,
  sqlite,
  pkg-config,
  rsync,
  makeWrapper,
  node-gyp,
  vips,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "nocodb";
  version = "0.260.2";
  src = ../.;

  buildPhase = ''
    export NODE_OPTIONS="--max_old_space_size=16384"
    export NUXT_TELEMETRY_DISABLED=1
    export npm_config_nodedir=${nodePackages.nodejs}

    pnpm --filter=nocodb-sdk run build
    pnpm run registerIntegrations
    pnpm --filter=nc-gui run build:copy
    pnpm --filter=nocodb run docker:build
  '';

  installPhase = ''
    mkdir -p $out/share/nocodb/packages/nocodb
    cp -v ./packages/nocodb/docker/main.js $out/share/nocodb/packages/nocodb/index.js

    # only ship nocodb workspace prod deps with node_modules (1.9GB -> 400MB)
    rm -rf ./node_modules ./packages/nocodb/node_modules
    pnpm install \
        --offline \
        --prod \
        --ignore-scripts \
        --filter=nocodb \
        --frozen-lockfile
    # nodejs 22.11.0 -> 22.12.0 broke pnpm rebuild somehow, so let's do it manaully
    # pnpm rebuild -r --verbose --reporter=append-only
    for package in $(find -L packages/nocodb/node_modules -name binding.gyp -type f); do
        cd "$(dirname "$package")"
        node-gyp rebuild
        cd -
    done

    cp -r ./node_modules $out/share/nocodb/node_modules
    cp -r ./packages/nocodb/node_modules $out/share/nocodb/packages/nocodb/node_modules

    makeWrapper "${lib.getExe nodePackages.nodejs}" "$out/bin/${finalAttrs.pname}" \
      --set NODE_ENV production \
      --add-flags "$out/share/nocodb/packages/nocodb/index.js"
  '';

  nativeBuildInputs = [
    nodePackages.pnpm
    pnpm.configHook
    node-gyp

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
    vips
  ];

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs) pname version src;
    hash = "sha256-jvMpIqgD/dUxEIlzW06c9aQ83nj4dShLKSGikRcM+Xo=";
  };

  meta = {
    description = "Open Source Airtable Alternative";
    homepage = "https://nocodb.com/";
    platforms = lib.platforms.linux;
    license = lib.licenses.agpl3Plus;
    mainProgram = finalAttrs.pname;
    maintainers = with lib.maintainers; [ sinanmohd ];
  };
})
