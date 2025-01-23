{
  description = "Open Source Airtable Alternative";

  inputs.nixpkgs.url = "github:NixOs/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
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
          nodejs = pkgs.callPackage ./nix/nodejs.nix { };
          nocodb = pkgs.callPackage ./nix/nocodb.nix { };
          default = self.packages.${system}.nocodb;
        }
      );

      nixosModules = {
        nocodb = ./nix/module.nix;
        default = self.nixosModules.cplane;
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
