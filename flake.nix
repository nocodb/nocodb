{
  description = "Open Source Airtable Alternative";

  inputs.nixpkgs.url = "github:NixOs/nixpkgs/nixos-unstable";

  outputs =
    inputs@{ self, nixpkgs }:
    let
      lib = nixpkgs.lib;

      forSystem =
        f: system:
        f {
          inherit system;
          pkgs = import nixpkgs { inherit system; };
        };

      forUnixSystems = f: lib.genAttrs lib.platforms.unix (forSystem f);
      forLinuxSystems = f: lib.genAttrs lib.platforms.linux (forSystem f);

      version =
        if self ? shortRev then
          self.shortRev
        else if self ? dirtyShortRev then
          self.dirtyShortRev
        else
          "not-a-gitrepo";
    in
    {
      packages =
        lib.recursiveUpdate
          (forUnixSystems (
            { system, pkgs }:
            {
              workflows = pkgs.callPackage ./nix/workflows { inherit self; };
              nocodb = pkgs.callPackage ./nix/packages/nocodb.nix {
                inherit version;
              };

              frontend-ssg = pkgs.callPackage ./nix/packages/frontend-ssg.nix {
                inherit version;
              };
              frontend-ssr = pkgs.callPackage ./nix/packages/frontend-ssr.nix {
                inherit version;
              };
              backend = pkgs.callPackage ./nix/packages/backend.nix {
                inherit version;
              };

              pnpmDeps = self.packages.${system}.nocodb.pnpmDeps;
              default = self.packages.${system}.nocodb;
            }
          ))
          (
            forLinuxSystems (
              { system, pkgs }:
              {
                docker_sa = pkgs.callPackage ./nix/docker/stand_alone {
                  nocodb = self.packages.${system}.nocodb;
                };
                docker_aio = pkgs.callPackage ./nix/docker/all_in_one {
                  nocodb = self.packages.${system}.nocodb;
                };
                docker_frontend = pkgs.callPackage ./nix/docker/frontend {
                  frontend = self.packages.${system}.frontend;
                };
                docker_backend = pkgs.callPackage ./nix/docker/backend {
                  backend = self.packages.${system}.backend;
                };
              }
            )
          );

      nixosModules = {
        nocodb = import ./nix/module.nix inputs;
        default = self.nixosModules.nocodb;
      };

      devShells = forUnixSystems (
        { system, pkgs }:
        {
          nocodb = pkgs.callPackage ./nix/shell.nix {
            nocodb = self.packages.${system}.nocodb;
          };
          default = self.devShells.${system}.nocodb;
        }
      );
    };
}
