#!/bin/sh

commit_message="chore(nix/pacakge/pnpmDeps): bump hash"
commit_author="sinanmohd <sinanmohd>"

hash_get() {
	grep -Eo 'sha256-[^=]*=' nix/package.nix
}

hash_set() {
	sed -i "s|sha256-[A-Za-z0-9+/=]\+|$1|" nix/package.nix
}

early_escape_possible() {
	last_bump_commit=$(git log --oneline | grep "$commit_message"  | cut -d' ' -f1)
	if [ -z "$last_bump_commit" ]; then
		return 1
	fi

	last_pnpm_time="$(git log -1 --format="%at" pnpm-lock.yaml)"
	last_bump_time="$(git log -1 --format="%at" "$last_bump_commit")"

	if [ "$last_bump_time" -lt "$last_pnpm_time" ]; then
		return 1
	fi

	return 0
}

nix_hash() {
	out="$(mktemp)"
	nix build .#pnpmDeps -L > "$out" 2>&1
	tac "$out" | grep -Eom1 'sha256-[^=]*='
}

##########
## MAIN ##
##########

if [ ! -w nix/package.nix ] || [ ! -r nix/package.nix ]; then
	echo "nix/package: not writiable or readable"
	exit 1
fi

if early_escape_possible; then
	echo "early escape suckcess : nix bump commit is newer"
	exit 0
else
	echo "early esacpe failuree : npm bump commit is newer, here we go again"
fi

fake_hash="sha256-0000000000000000000000000000000000000000000="
cur_hash="$(hash_get)"
hash_set "$fake_hash"
new_hash="$(nix_hash)"

if [ -z "$new_hash" ]; then
	echo "empty hash: must be same"
	exit 0
fi

if [ "$cur_hash" != "$new_hash" ]; then
	echo "hash changed: ${cur_hash} -> ${new_hash}"
	hash_set "$new_hash"

	git add nix/pacakge.nix
	git commit --author="$commit_author" -m "$commit_message"
else
	echo "hash staysss: waiting for your next commit"
fi
