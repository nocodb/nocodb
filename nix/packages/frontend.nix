{
  lib,
  stdenv,
  nodejs,
  pnpm,
  version,
}:

stdenv.mkDerivation (finalAttrs: {
  inherit version;
  pname = "nocodb-frontend";

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
    export NODE_OPTIONS="--max_old_space_size=16384"
    export NUXT_TELEMETRY_DISABLED=1
    export npm_config_nodedir=${nodejs}

    pnpm --filter=nocodb-sdk run build
    pnpm --filter=nc-gui exec nuxt generate
  '';

  installPhase = ''
    mkdir -p $out/share/www
    cp -rv packages/nc-gui/.output/public $out/share/www/dashboard
  '';

  nativeBuildInputs = [
    nodejs
    pnpm.configHook
  ];

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs) pname version src;
    hash = "sha256-fXm6q0syEUGszFE2IeCa8BNrbp9UKYqK4mPUxAH5zqg=";
  };

  meta = {
    description = "Open Source Airtable Alternative Frontend";
    homepage = "https://nocodb.com/";
    platforms = lib.platforms.linux ++ lib.platforms.darwin;
    license = lib.licenses.agpl3Plus;
    maintainers = with lib.maintainers; [ sinanmohd ];
  };
})
