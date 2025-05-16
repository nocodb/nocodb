{
  lib,
  stdenv,
  nodejs,
  pnpm,
  version,
  makeWrapper,
}:

stdenv.mkDerivation (finalAttrs: {
  inherit version;
  pname = "nocodb-frontend-ssr";

  src = lib.cleanSourceWith {
    filter =
      name: type:
      lib.cleanSourceFilter name type
      && !(builtins.elem (baseNameOf name) [
        "nix"
        "flake.nix"
      ]);

    src = ../../.;
  };

  buildPhase = ''
    pnpm --filter=nocodb-sdk run build

    export NODE_OPTIONS="--max_old_space_size=16384"
    export NUXT_TELEMETRY_DISABLED=1
    export NUXT_SSR=true
    export HASH_MODE=false
    export NUXT_APP_BASE_URL="/dashboard/"
    pnpm --filter=nc-gui exec nuxt build
  '';

  installPhase = ''
    mkdir -p $out/share/www/
    cp -rv packages/nc-gui/.output/server $out/share/www/
    cp -rv packages/nc-gui/.output/public $out/share/www/

    makeWrapper "${lib.getExe nodejs}" "$out/bin/nocodb-frontend-ssr" \
      --set NODE_ENV production \
      --set SSR true \
      --set HASH_MODE false \
      --add-flags "$out/share/www/server/index.mjs"
  '';

  nativeBuildInputs = [
    makeWrapper
    pnpm.configHook
  ];
  buildInputs = [
    nodejs
  ];

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs) pname version src;
    hash = "sha256-QcVnvXnPmhp3qJGxK8958CFxo+a0jwGRRyhtDuyK8sA=";
  };

  meta = {
    description = "Open Source Airtable Alternative Frontend";
    homepage = "https://nocodb.com/";
    platforms = lib.platforms.linux ++ lib.platforms.darwin;
    license = lib.licenses.agpl3Plus;
    mainProgram = "nocodb-frontend-ssr";
    maintainers = with lib.maintainers; [ sinanmohd ];
  };
})
