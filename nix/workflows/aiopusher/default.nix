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
    image="nocodb/nocodb"

    note () {
      echo aiopusher: "$@"
    }

    secret_get() {
      sops decrypt --extract "[\"app.docker.com\"][\"$1\"]"  ${./secrets.yaml}
    }

    image_build() {
      # $1: nix arch
      package="packages.$1.docker_aio"
      note "building $image:$1 with $package"

      nix build "${self}#$package" -L
      tag="$(docker image load -i result | tail -n1 | cut -d: -f3)"
      id="$(docker image ls --format "{{.ID}}:{{.Tag}}" | grep "$tag" | cut -d: -f1)"

      docker image tag "$id" "$image:$1"
    }

    image_push() {
      # $1: string tag
      # $2: arch tag 1
      # $3: arch tag 1
      # $4?: version tag

      docker manifest \
        create "$image:$1" \
        --amend "$image:$2" \
        --amend "$image:$3"
      docker manifest push "$image:$1"

      if [ -n "$4" ]; then
        docker image tag "$image:$1" "$image:$4"
        docker push "$image:$4"
      fi
    }

    ########
    # MAIN #
    ########
    # $1?: string tag
    # $1?: version tag

    docker login \
      --username "$(secret_get username)" \
      --password "$(secret_get password)"

    image_build x86_64-linux
    image_build aarch64-linux
    image_push "''${1:-untagged}" x86_64-linux aarch64-linux "$2"
  '';
}
