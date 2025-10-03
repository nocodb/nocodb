{
  config,
  pkgs,
  lib,
  ...
}:
let
  imageTag =
    {
      x86_64-linux = "amd64_latest";
      aarch64-linux = "aarch64_latest";
    }
    .${pkgs.system};
  image = "nocodb/nocodb_aio:${imageTag}";

  stateDirectory = "/var/lib/nocodb_aio";
  envFile = "${stateDirectory}/aio.env";

  aioSetup = pkgs.writeShellApplication {
    name = "aio_setup";
    runtimeInputs = with pkgs; [ coreutils ];

    text = ''
      mkdir -p ${stateDirectory}/data

      if [ ! -f ${envFile} ]; then
        echo aio_minio_enable=false >> ${envFile};
      fi

      chmod 666 ${envFile}
    '';
  };

  aioUpdate = pkgs.writeShellApplication {
    name = "aio_update";
    runtimeInputs = with pkgs; [
      podman
      systemd
    ];

    text = ''
      podman pull ${image}
      systemctl restart ${aioServiceName}
    '';
  };

  nocodbSettings = pkgs.writeShellApplication {
    name = "nocodb-settings";
    runtimeInputs = with pkgs; [
      nano
      systemd
      coreutils
    ];

    text = ''
      hash_old="$(sha256sum ${envFile})"
      ''${EDITOR:-nano} ${envFile}
      hash_new="$(sha256sum ${envFile})"

      if [ "$hash_old" = "$hash_new" ]; then
        echo "No changes, exiting quietly"
      else
        echo "Applying Changes"
        sudo systemctl restart ${aioServiceName}
      fi
    '';
  };

  aioServiceName = "${config.virtualisation.oci-containers.backend}-nocodb_aio.service";
  userName = "nocodb";
in
{
  system.stateVersion = "25.05";

  services.getty = {
    greetingLine = ''
      ███╗░░██╗░█████╗░░█████╗░░█████╗░██████╗░██████╗░   ██╗███╗░░░███╗░█████╗░░██████╗░███████╗
      ████╗░██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗   ██║████╗░████║██╔══██╗██╔════╝░██╔════╝
      ██╔██╗██║██║░░██║██║░░╚═╝██║░░██║██║░░██║██████╦╝   ██║██╔████╔██║███████║██║░░██╗░█████╗░░
      ██║╚████║██║░░██║██║░░██╗██║░░██║██║░░██║██╔══██╗   ██║██║╚██╔╝██║██╔══██║██║░░╚██╗██╔══╝░░
      ██║░╚███║╚█████╔╝╚█████╔╝╚█████╔╝██████╔╝██████╦╝   ██║██║░╚═╝░██║██║░░██║╚██████╔╝███████╗
      ╚═╝░░╚══╝░╚════╝░░╚════╝░░╚════╝░╚═════╝░╚═════╝░   ╚═╝╚═╝░░░░░╚═╝╚═╝░░╚═╝░╚═════╝░╚══════╝
    '';
    helpLine = ''
      Default Username: nocodb
      Default Password: nocodb

      Run `nocodb-settings` to modify nocodb configuration";
      Run `passwd` to change the default password
    '';
  };

  programs.nano.enable = true;
  environment = {
    binsh = lib.getExe pkgs.dash;

    systemPackages = with pkgs; [
      nocodbSettings
      dash
      neovim
      curl
      iproute2
      iputils
    ];

    variables = {
      EDITOR = "nano";
      VISUAL = "nano";
    };

    shellAliases = {
      grep = "grep --color=auto";
      ls = "ls --color=auto --group-directories-first";
    };
  };

  security.sudo = {
    enable = true;

    extraRules = [{
      users = [ userName ];
      commands = [{
        command = "${pkgs.systemd}/bin/systemctl restart ${aioServiceName}";
        options = [ "SETENV" "NOPASSWD" ];
      }];
    }];
  };

  users.users.${userName} = {
    uid = 1000;
    isNormalUser = true;
    initialPassword = userName;
    description = "NocoDB Maintenance User";
    extraGroups = [ "wheel" ];
  };

  networking = {
    hostName = "nocodb";

    firewall.allowedTCPPorts = [
      80
      443
      9000
    ];
  };

  systemd = {
    services = {
      aio_setup = {
        enable = true;
        description = "NocoDB aio Setup";
        wantedBy = [ aioServiceName ];

        serviceConfig = {
          Type = "oneshot";
          ExecStart = lib.getExe aioSetup;
        };
      };

      aio_update = {
        description = "NocoDB aio Auto Updater";
        serviceConfig = {
          Type = "oneshot";
          ExecStart = lib.getExe aioUpdate;
        };
      };
    };

    timers.aio_update = {
      description = "NocoDB aio Auto Update Timer";
      wantedBy = [ "timers.target" ];

      timerConfig = {
        OnCalendar = "*-*-* 00,06,12,18:00:00";
        Unit = "%i.service";
        Persistent = true;
        FixedRandomDelay = true;
        RandomizedDelaySec = "6h";
      };
    };
  };

  virtualisation.oci-containers.containers.nocodb_aio = {
    inherit image;
    volumes = [ "${stateDirectory}/data:/var" ];
    environmentFiles = [ "${envFile}" ];

    ports = [
      "[::]:80:80" # http & acme-challenge
      "[::]:443:443" # https
      "[::]:9000:9000" # minio
      "[::]:8080:8080" # proxy bypass

      "0.0.0.0:80:80" # http & acme-challenge
      "0.0.0.0:443:443" # https
      "0.0.0.0:9000:9000" # minio
      "0.0.0.0:8080:8080" # proxy bypass
    ];
  };
}
