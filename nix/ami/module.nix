{ ... }: {
  system.stateVersion = "25.05";
  virtualisation.diskSize = 1024 * 8; # 8GB

  networking.firewall.allowedTCPPorts = [ 8080 ];
  services.nocodb.enable = true;
}
