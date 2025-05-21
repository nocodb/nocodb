{
  mkShell,
  nocodb,
  nixfmt-rfc-style,
  shfmt,
  typescript-language-server,
  nodejs
}:
mkShell {
  inputsFrom = [ nocodb ];

  buildInputs = [
    nixfmt-rfc-style
    shfmt
    typescript-language-server
  ];

  shellHook = ''
    export PS1="\033[0;34m[ ]\033[0m $PS1"
    export NODE_ENV="development"

    export npm_config_nodedir=${nodejs}
    pnpm config set store-dir ~/.local/share/pnpm

    # since we do not want to dependent on dynamically linked deps,
    # we do not want to cache platform dependent outputs
    pnpm config set side-effects-cache false
  '';
}
