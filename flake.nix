{
  description = "Open Source Airtable Alternative";

  inputs = {
    nixpkgs.url = "github:NixOs/nixpkgs/nixos-unstable";

    nixos-generators = {
      url = "github:nix-community/nixos-generators";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{ self, nixpkgs, nixos-generators }:
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
          docker = pkgs.callPackage ./nix/docker.nix { };
          nocodb = pkgs.callPackage ./nix/package.nix { };
          bumper = pkgs.callPackage ./nix/bumper { };
          ami = pkgs.callPackage (import ./nix/ami inputs) {
            inherit system;
            nixosGenerate = nixos-generators.nixosGenerate;
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
