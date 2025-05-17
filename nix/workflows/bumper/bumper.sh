#!/bin/sh

set +o nounset

commit_message="chore(nix/package/pnpmDeps): bump hash"
commit_author="auto walle"
commit_email="auto@sinanmohd.com"
package_path="nix/package.nix"

hash_get() {
	grep -Eo 'sha256-[^=]*=' "$package_path"
}

hash_set() {
	sed -i "s|sha256-[A-Za-z0-9+/=]\+|$1|" "$package_path"
}

err() {
	echo error: "$@"
	exit 1
}

early_escape_possible() {
	last_pnpm_time="$(git log -1 --format="%at" pnpm-lock.yaml)"
	last_bump_time=$(git log --oneline --grep="^${commit_message}$" -n 1 --format="%at")
	if [ -z "$last_bump_time" ]; then
		return 1
	fi

	if [ "$last_bump_time" -lt "$last_pnpm_time" ]; then
		return 1
	fi

	return 0
}

nix_hash() {
	out="$(mktemp)"

	nix build .#pnpmDeps -L > "$out" 2>&1
	tac "$out" | grep -Eom1 'sha256-[^=]*='

	rm "$out"
}

##########
## MAIN ##
##########

if [ ! -w "$package_path" ] || [ ! -r "$package_path" ]; then
	err "$package_path is not writiable or readable"
elif [ "$1" = "--push" ] && [ -n "$(git status --untracked-files=no --porcelain)" ]; then
	err "dirty git tree"
fi

if [ "$1" = "--push" ]; then
	if early_escape_possible; then
		echo "early escape success : nix bump commit is newer"
		exit 0
	else
		echo "npm bump commit is newer, here we go again"
	fi
fi

fake_hash="sha256-0000000000000000000000000000000000000000000="
cur_hash="$(hash_get)"
hash_set "$fake_hash"
new_hash="$(nix_hash)"

if [ "$cur_hash" != "$new_hash" ]; then
	echo "hash changed: ${cur_hash} -> ${new_hash}"
	hash_set "$new_hash"

	if [ "$1" = "--push" ]; then
		git add "$package_path"
		git commit \
			--author="$commit_author <$commit_email>" \
			-m "$commit_message"
		git push
	fi
else
	echo "hash did not change: waiting for your next commit"
	hash_set "$cur_hash"
fi
