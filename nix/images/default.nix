inputs:
{
  nixosGenerate,
  system,
  lib,
}:
let
  imageForFormat =
    format:
    nixosGenerate {
      inherit system format;

      modules = [
        ./module.nix
        inputs.self.nixosModules.nocodb
      ];
    };

  supportedFormats = [
    "amazon"
    "azure"
    "do"
    "gce"
    "linode"
    "iso"
  ];
in
lib.genAttrs supportedFormats imageForFormat
