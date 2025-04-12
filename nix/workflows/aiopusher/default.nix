{
  writeShellApplication,
  coreutils,
  docker,
  nix,
  sops,
  self,
}:
writeShellApplication {
  name = "aiopusher";

  runtimeInputs = [
    nix
    docker
    coreutils
    sops
  ];

  text = ''
    image="nocodb/nocodb_aio"

    note () {
      echo "$@"
    }

    secret_get() {
      sops decrypt --extract "[\"app.docker.com\"][\"$1\"]"  ${./secrets.yaml}
    }

    image_push() {
      # $1: nix arch
      # $2: tag
      package="packages.$1.docker_aio"
      note "updating $image:$2 with $package"

      nix build "${self}#$package" -L
      tag="$(docker image load -i result | tail -n1 | cut -d: -f3)"
      id="$(docker image ls --format "{{.ID}}:{{.Tag}}" | grep "$tag" | cut -d: -f1)"

      docker image tag "$id" "$image:$2"
      docker push "$image:$2"
    }

    multiarch_image_push() {
      # $1: multiarch tag
      # $2: arch tag 1
      # $3: arch tag 1

      docker manifest \
        create "$image:$1" \
        --amend "$image:$2" \
        --amend "$image:$3"

      docker manifest push "$image:$1"
    }

    ########
    # MAIN #
    ########

    docker login \
      --username "$(secret_get username)" \
      --password "$(secret_get password)"

    image_push x86_64-linux amd64_latest
    image_push aarch64-linux arm64_latest
    multiarch_image_push latest amd64_latest arm64_latest
  '';
}
