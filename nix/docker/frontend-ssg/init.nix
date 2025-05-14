{
  writeShellApplication,
  coreutils,
  shadow,
  dockerTools,
  dumb-init,
  nginxConf,
  nginxCustom,
  lib,
}:
writeShellApplication {
  name = "init";

  runtimeInputs = [
    coreutils
    shadow
  ];

  text = ''
    # setup users & groups
    ${dockerTools.shadowSetup}
    groupadd -r nogroup
    useradd -r -g nogroup nobody

    mkdir -p /tmp/nginx_client_body
    mkdir -p /run/nginx
    # stateful logs
    mkdir -p /var/log/nginx

    ${lib.getExe dumb-init} -- ${lib.getExe nginxCustom} -c ${nginxConf}/etc/nginx.conf
  '';
}
