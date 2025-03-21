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
    "cloudstack"
    "do"
    "docker"
    "gce"
    "hyperv"
    "install-iso"
    "install-iso-hyperv"
    "iso"
    "kexec"
    "kexec-bundle"
    "kubevirt"
    "linode"
    "lxc"
    "lxc-metadata"
    "openstack"
    "proxmox"
    "proxmox-lxc"
    "qcow"
    "qcow-efi"
    "raw"
    "raw-efi"
    "sd-aarch64"
    "sd-aarch64-installer"
    "sd-x86_64"
    "vagrant-virtualbox"
    "virtualbox"
    "vm"
    "vm-bootloader"
    "vm-nogui"
    "vmware"
  ];
in
lib.genAttrs supportedFormats imageForFormat
