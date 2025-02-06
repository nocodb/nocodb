inputs:
{
  nixosGenerate,
  system,
}:

nixosGenerate {
  inherit system;
  format = "amazon";

  modules = [
    ./module.nix
    inputs.self.nixosModules.nocodb
  ];
}
