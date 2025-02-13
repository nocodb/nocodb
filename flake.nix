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

      supportedSystems = lib.platforms.unix;
      forAllSystems = f: lib.genAttrs supportedSystems (forSystem f);
    in
    {
      packages = forAllSystems (
        { system, pkgs }:
        {
          docker_sa = pkgs.callPackage ./nix/docker/stand_alone {
            nocodb = self.packages.${system}.nocodb;
          };
          docker_aio = pkgs.callPackage ./nix/docker/all_in_one {
            nocodb = self.packages.${system}.nocodb;
          };

          bumper = pkgs.callPackage ./nix/bumper { };
          nocodb = pkgs.callPackage ./nix/package.nix {
            version = if self ? shortRev then self.shortRev else self.dirtyShortRev;
          };

          pnpmDeps = self.packages.${system}.nocodb.pnpmDeps;
          default = self.packages.${system}.nocodb;
        }
      );

      nixosModules = {
        nocodb = import ./nix/module.nix inputs;
        default = self.nixosModules.nocodb;
      };

      devShells = forAllSystems (
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
