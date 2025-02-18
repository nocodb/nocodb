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
    in
    {
      packages =
        lib.recursiveUpdate
          (forUnixSystems (
            { system, pkgs }:
            {
              bumper = pkgs.callPackage ./nix/bumper { };
              nocodb = pkgs.callPackage ./nix/package.nix {
                version = if self ? shortRev then self.shortRev else self.dirtyShortRev;
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
