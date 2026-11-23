# First publication and history audit

**Status:** implemented

This is a maintainer-only procedure for the **first** publication of an unpublished
`samata-ml` repository. It does not authorise publication, change a remote, or
rewrite the working repository. It removes the twelve historical sample CSVs
from a disposable publication clone while retaining ordinary history. Commit
IDs change. Keep the original repository and a private full backup. If a public
destination already has history, stop: that is a different remediation and needs
a maintainer decision. See the [filter-repo manual](https://github.com/newren/git-filter-repo/blob/main/Documentation/git-filter-repo.txt)
and [GitHub's history-removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

The historical IDs are `adult-census`, `bank-marketing`,
`breast-cancer-wisconsin`, `compas-recidivism`, `credit-card-default`,
`german-credit`, `heart-disease`, `iris`, `palmer-penguins`, `pima-diabetes`,
`student-dropout` and `titanic`. Both `content/datasets/<id>/data.csv` and
`public/datasets/<id>/data.csv` are in scope. `titanic-inquiry` has no tracked
CSV. The [catalogue specification](sample-datasets.md) describes the current
sources, attributions and rights. The old Pima and Seaborn Titanic rights are
unconfirmed; [OpenML 37](https://www.openml.org/api/v1/json/data/37) and
[Seaborn provenance](https://github.com/mwaskom/seaborn-data#data-sources) do
not establish rights for those exact files. ProPublica's
[terms](https://projects.propublica.org/datastore/terms/) restrict redistribution.

## Preconditions and freeze

Use a trusted shell with Git, Python 3, `git-filter-repo`, Bun and Gitleaks
installed. Read every step before proceeding. Run all blocks in the same shell with `set -eu`; on any failure stop and discard the candidate. Treat all audit files, reports and
the original history as private; never add them to either repository. Choose an
absolute private directory outside every repository, on storage with adequate
space. Do not use a shared or existing directory. The examples below use shell
variables only for this procedure; substitute actual paths and a destination
name. The destination must be verified independently in GitHub as nonexistent; an authentication or network error is not evidence
of absence. Stop if any of these facts cannot be established.

```sh
set -eu
export SOURCE='/absolute/path/to/private/samata-ml'
export PRIVATE='/absolute/path/to/new/private-publication-audit'
export CANDIDATE="$PRIVATE/candidate"
test -d "$SOURCE/.git" && test ! -e "$PRIVATE" || exit 1
mkdir -m 700 "$PRIVATE" || exit 1
export SOURCE="$(cd "$SOURCE" && pwd -P)"
export PRIVATE="$(cd "$PRIVATE" && pwd -P)"
export CANDIDATE="$PRIVATE/candidate"
case "$PRIVATE/" in "$SOURCE/"* ) echo 'STOP: private directory inside source'; exit 1;; esac
test -z "$(git -C "$SOURCE" status --porcelain)" || exit 1
export FROZEN="$(git -C "$SOURCE" rev-parse --verify 'refs/heads/main^{commit}')"
test "$(git -C "$SOURCE" rev-parse HEAD)" = "$FROZEN" || exit 1
printf '%s\n' "$FROZEN" > "$PRIVATE/source-tip"
git clone --mirror --no-local "$SOURCE" "$PRIVATE/private-backup.git"
test "$(git --git-dir="$PRIVATE/private-backup.git" rev-parse refs/heads/main)" = "$FROZEN" || exit 1
git --git-dir="$PRIVATE/private-backup.git" fsck --full --no-reflogs || exit 1
git clone --no-local --single-branch --branch main --no-tags "$SOURCE" "$CANDIDATE"
test "$(git -C "$CANDIDATE" rev-parse HEAD)" = "$FROZEN" || exit 1
test -z "$(git -C "$CANDIDATE" status --porcelain)" || exit 1
test "$(git -C "$CANDIDATE" rev-parse --git-dir)" = .git || exit 1
test "$(git -C "$CANDIDATE" rev-parse --git-common-dir)" = .git || exit 1
test ! -s "$CANDIDATE/.git/objects/info/alternates" || exit 1
test -z "${GIT_ALTERNATE_OBJECT_DIRECTORIES-}${GIT_OBJECT_DIRECTORY-}" || exit 1
test "$(git -C "$CANDIDATE" remote)" = origin || exit 1
test "$(git -C "$CANDIDATE" remote get-url origin)" = "$SOURCE" || exit 1
```

Confirm the backup is readable and kept separately. Do not proceed if source,
backup or candidate paths resolve to the same repository, the candidate is a
worktree or has alternates, a source tip changes, a destination is unsafe, or
any command fails. Never use `--force` to bypass filter-repo's fresh-clone check.

## Enumerate every tree and identify aliases

Save the following helper as `$PRIVATE/audit.py`. It reads only the exact commit
graph named by `FROZEN` and writes private audit files outside the candidate. It
stops on paths that cannot be represented safely by the line-based filter file.
The helper does not judge whether a different blob is an embedded, renamed or
transformed full sample: the maintainer must inspect the complete path/size
inventory and any suspect artefacts separately. Do not print raw data or secrets.

```python
import os
import pathlib
import subprocess
import sys

private = pathlib.Path(os.environ['PRIVATE']).resolve()
source = pathlib.Path(os.environ['SOURCE']).resolve()
candidate = pathlib.Path(os.environ['CANDIDATE']).resolve()
frozen = os.environ['FROZEN']
if private == source or source in private.parents or private in source.parents or candidate.parent != private:
    sys.exit('STOP: unsafe paths')

def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])

def entries(repo, ref):
    commits = git(repo, 'rev-list', ref).decode('ascii').splitlines()
    result = []
    for commit in commits:
        for item in git(repo, 'ls-tree', '-rz', '--full-tree', commit).split(b'\0'):
            if not item:
                continue
            meta, raw_path = item.split(b'\t', 1)
            mode, kind, oid = meta.decode('ascii').split()
            if kind != 'blob':
                sys.exit('STOP: submodule or unexpected tree entry requires review')
            name = raw_path.decode('utf-8', 'strict')
            if any(char in name for char in ('\n', '\r', '\t')) or name.startswith(('#', 'literal:', 'glob:', 'regex:')):
                sys.exit('STOP: path cannot be represented in filter file')
            result.append((commit, name, oid, mode))
    return commits, result

ids = ('adult-census bank-marketing breast-cancer-wisconsin compas-recidivism '
       'credit-card-default german-credit heart-disease iris palmer-penguins '
       'pima-diabetes student-dropout titanic').split()
initial = {f'{root}/datasets/{name}/data.csv'
           for root in ('content', 'public') for name in ids}
mode = sys.argv[1]
if mode == 'collect':
    commits, rows = entries(candidate, frozen)
    blobs = {oid for _, name, oid, _ in rows if name in initial}
    if not blobs:
        sys.exit('STOP: no historical dataset blobs found')
    aliases = {(name, oid) for _, name, oid, _ in rows if oid in blobs and name not in initial}
    sizes = {}
    for oid in {oid for _, _, oid, _ in rows}:
        sizes[oid] = int(git(candidate, 'cat-file', '-s', oid))
    (private / 'tree-inventory.tsv').write_text(''.join(
        f'{commit}\t{oid}\t{sizes[oid]}\t{mode}\t{name}\n' for commit, name, oid, mode in rows))
    (private / 'paths.txt').write_text(''.join(f'{p}\n' for p in sorted(initial)))
    (private / 'blobs.txt').write_text(''.join(f'{oid}\n' for oid in sorted(blobs)))
    (private / 'aliases.tsv').write_text(''.join(f'{name}\t{oid}\n' for name, oid in sorted(aliases)))
    (private / 'source-commits').write_text('\n'.join(commits) + '\n')
    print(f'Inventoried {len(commits)} commits, {len(blobs)} sample blobs and {len(aliases)} alias paths.')
elif mode == 'check-aliases':
    paths = set((private / 'paths.txt').read_text().splitlines())
    blobs = set((private / 'blobs.txt').read_text().splitlines())
    _, rows = entries(candidate, frozen)
    aliases = {name for _, name, oid, _ in rows if oid in blobs}
    if not initial <= paths or not aliases <= paths:
        sys.exit('STOP: required path or identical-blob alias omitted')
    print('All known paths and identical-blob aliases are listed.')
elif mode == 'verify':
    paths = set((private / 'paths.txt').read_text().splitlines())
    blobs = set((private / 'blobs.txt').read_text().splitlines())
    commits, rows = entries(candidate, 'refs/heads/main')
    if any(name in paths or oid in blobs for _, name, oid, _ in rows):
        sys.exit('STOP: removed path or blob remains in a reachable tree')
    objects = set(git(candidate, 'rev-list', '--objects', '--no-object-names',
                      'refs/heads/main').decode('ascii').splitlines())
    if objects & blobs:
        sys.exit('STOP: a removed blob remains reachable')
    if git(source, 'rev-parse', frozen + '^{tree}') != git(candidate, 'rev-parse', 'refs/heads/main^{tree}'):
        sys.exit('STOP: candidate tip tree differs from the frozen source')
    if len(commits) < 2:
        sys.exit('STOP: surviving history is unexpectedly short')
    old_commits, old_rows = entries(source, frozen)
    old_trees = {commit: {} for commit in old_commits}
    new_trees = {commit: {} for commit in commits}
    for commit, name, oid, mode in old_rows:
        if name not in paths and oid not in blobs:
            old_trees[commit][name] = (oid, mode)
    for commit, name, oid, mode in rows:
        new_trees[commit][name] = (oid, mode)
    mapping = (private / 'commit-map').read_text().splitlines()[1:]
    mapped = 0
    seen_old, seen_new = set(), set()
    for line in mapping:
        old, new = line.split()
        seen_old.add(old)
        if set(new) == {'0'}:
            continue
        if old not in old_trees or new not in new_trees or old_trees[old] != new_trees[new]:
            sys.exit('STOP: a surviving commit changed non-dataset tree content')
        seen_new.add(new)
        mapped += 1
    if not mapped or seen_old != set(old_commits) or seen_new != set(commits):
        sys.exit('STOP: commit map does not cover the exact source and surviving commits')
    print(f'Verified {len(commits)} reachable commits, all trees and reachable objects; {mapped} mapped commits preserve non-dataset content.')
else:
    sys.exit('STOP: unknown mode')
```

Before running it, check that `HEAD` is `main`, the frozen tip still matches,
and the only refs are the local main and its local-source tracking refs. Reject
tags, replace refs, additional branches and unexpected remote refs. This check
must succeed before collection **and again immediately before filtering**:

```sh
test "$(git -C "$SOURCE" rev-parse refs/heads/main)" = "$FROZEN" || exit 1
test "$(git -C "$CANDIDATE" symbolic-ref --short HEAD)" = main || exit 1
test "$(git -C "$CANDIDATE" rev-parse refs/heads/main)" = "$FROZEN" || exit 1
test -z "$(git -C "$CANDIDATE" status --porcelain)" || exit 1
git -C "$CANDIDATE" for-each-ref --format='%(refname)' > "$PRIVATE/refs-before"
while IFS= read -r ref; do
  case "$ref" in refs/heads/main|refs/remotes/origin/main|refs/remotes/origin/HEAD) ;;
    *) echo "STOP: unexpected ref $ref"; exit 1;; esac
done < "$PRIVATE/refs-before"
python3 "$PRIVATE/audit.py" collect
```

Review `tree-inventory.tsv` (commit, blob ID, byte size, mode, path) and
`aliases.tsv` privately. Find aliases, earlier names and copies inside other
tracked artefacts, including copies with different bytes; compare provenance and
history, not only names. Append each positively identified alias path to
`paths.txt` and every additional identified full-sample blob ID to `blobs.txt`.
Re-run the inventory/review as needed, preserving those additions separately
before `collect`, which recreates its output. If any full-sample candidate is
unclassified, stop and resolve it; do not guess. Confirm every alias in
`aliases.tsv` is reviewed and listed. The check also searches all trees for
aliases of any additional blob IDs added during review. The helper catches a deliberately omitted
identical-blob alias:

```sh
python3 "$PRIVATE/audit.py" check-aliases
```

## Filter and verify the candidate

Repeat all freeze, clean-tree, ref, remote, alternates, path and destination
checks above, including `check-aliases`; do not rerun `collect` after adding
reviewed paths. From the disposable candidate only:

```sh
cd "$CANDIDATE" || exit 1
git filter-repo --invert-paths --paths-from-file "$PRIVATE/paths.txt" \
  --strip-blobs-with-ids "$PRIVATE/blobs.txt" --replace-refs delete-no-add
test "$(git symbolic-ref --short HEAD)" = main || exit 1
test -z "$(git status --porcelain)" || exit 1
test -z "$(git remote)" || exit 1
test ! -s .git/objects/info/alternates || exit 1
test "$(git for-each-ref --format='%(refname)')" = refs/heads/main || exit 1
cp .git/filter-repo/commit-map "$PRIVATE/commit-map"
git rev-parse refs/heads/main > "$PRIVATE/filtered-tip"
python3 "$PRIVATE/audit.py" verify
test "$(git -C "$SOURCE" rev-parse refs/heads/main)" = "$FROZEN" || exit 1
test "$(git --git-dir="$PRIVATE/private-backup.git" rev-parse refs/heads/main)" = "$FROZEN" || exit 1
```

Review the private commit map and compare the surviving log against
`source-commits`; the helper compares non-dataset tree content for every mapped
surviving commit. Commits made empty solely by filtering can be pruned. The exact tip tree equality above checks all current tracked content,
including modes and non-dataset files. It does not prove an unknown copy was
identified: the inventory review is mandatory. Ensure there are no tags,
replace refs, extra refs or remotes carrying old history, no linked alternates,
and no stale filter files or private artefacts in the candidate. Verify the
source and backup still point to `FROZEN` and their histories are intact.

Scan the exact candidate `main` history without printing secret values. For
example, with a locally installed current Gitleaks, write only a redacted report
outside the candidate and require a successful exit and an empty report. Treat
scanner errors, skipped material, findings or ambiguous results as a stop; use
the organisation's approved additional scans as well. Redaction does not make a
report public. Do not reuse a permissive baseline or ignore unreviewed findings.

```sh
export CLEAN="$(git -C "$CANDIDATE" rev-parse refs/heads/main)"
gitleaks git "$CANDIDATE" --no-banner --redact=100 --report-format=json \
  --report-path "$PRIVATE/samata-secrets.json" --log-opts="$CLEAN"
python3 -c 'import json,os,sys; p=os.path.join(os.environ["PRIVATE"],"samata-secrets.json"); sys.exit(0 if json.load(open(p)) == [] else 1)'
cd "$CANDIDATE" || exit 1
bun run check
bun run build
bun run test:e2e
```

The candidate must pass its normal verification before publication; do not
claim a pass from a different checkout's server. A failed step means discard
the candidate and restart from the unchanged private source. Never merge an old
pre-filter ref into the candidate or any later public clone.

## Synthetic dry run

This walkthrough creates only synthetic text in a new private temporary
directory. It requires the helper above and a working `git filter-repo` on
`PATH`. It never operates on the working repository. Use a fresh shell and the
helper saved above; the `SOURCE`, `PRIVATE`, `CANDIDATE` and `FROZEN` values
below are deliberately replaced with synthetic paths. The negative checks must
fail as shown before continuing.

```sh
set -eu
export LAB="$(mktemp -d "${TMPDIR:-/tmp}/samata-publication-dry-run.XXXXXX")"
export SOURCE="$LAB/source"
export PRIVATE="$LAB/audit"
export CANDIDATE="$PRIVATE/candidate"
mkdir -p "$SOURCE" "$PRIVATE"
cp /absolute/path/to/audit.py "$PRIVATE/audit.py" # the helper above
git init -b main "$SOURCE"
git -C "$SOURCE" config user.name 'Synthetic Test'
git -C "$SOURCE" config user.email 'synthetic@example.invalid'
mkdir -p "$SOURCE/content/datasets/iris" "$SOURCE/archive"
printf 'synthetic sample\n' > "$SOURCE/content/datasets/iris/data.csv"
cp "$SOURCE/content/datasets/iris/data.csv" "$SOURCE/archive/alias.csv"
printf 'project history\n' > "$SOURCE/README.md"
git -C "$SOURCE" add content/datasets/iris/data.csv archive/alias.csv README.md
git -C "$SOURCE" commit -m 'synthetic old sample and alias'
mkdir -p "$SOURCE/public/datasets/iris"
git -C "$SOURCE" mv content/datasets/iris/data.csv public/datasets/iris/data.csv
git -C "$SOURCE" commit -m 'synthetic new location'
git -C "$SOURCE" rm public/datasets/iris/data.csv archive/alias.csv
printf 'more project history\n' >> "$SOURCE/README.md"
git -C "$SOURCE" add README.md
git -C "$SOURCE" commit -m 'synthetic current tree'
export FROZEN="$(git -C "$SOURCE" rev-parse refs/heads/main)"
git clone --mirror --no-local "$SOURCE" "$PRIVATE/private-backup.git"
git --git-dir="$PRIVATE/private-backup.git" fsck --full --no-reflogs
git clone --no-local --single-branch --branch main --no-tags "$SOURCE" "$CANDIDATE"
python3 "$PRIVATE/audit.py" collect
if python3 "$PRIVATE/audit.py" check-aliases; then echo 'STOP: omitted alias was accepted'; exit 1; fi
printf '%s\n' 'archive/alias.csv' >> "$PRIVATE/paths.txt"
python3 "$PRIVATE/audit.py" check-aliases
git -C "$CANDIDATE" branch unexpected
if test "$(git -C "$CANDIDATE" for-each-ref --format='%(refname)' refs/heads)" = refs/heads/main; then echo 'STOP: extra ref was accepted'; exit 1; fi
git -C "$CANDIDATE" branch -d unexpected
if SOURCE="$SOURCE" PRIVATE="$SOURCE/unsafe" CANDIDATE="$SOURCE/unsafe/candidate" python3 "$PRIVATE/audit.py" check-aliases; then echo 'STOP: unsafe destination was accepted'; exit 1; fi
cd "$CANDIDATE" || exit 1
git filter-repo --invert-paths --paths-from-file "$PRIVATE/paths.txt" \
  --strip-blobs-with-ids "$PRIVATE/blobs.txt" --replace-refs delete-no-add
test "$(git for-each-ref --format='%(refname)')" = refs/heads/main || exit 1
test -z "$(git remote)" || exit 1
cp .git/filter-repo/commit-map "$PRIVATE/commit-map"
python3 "$PRIVATE/audit.py" verify
test "$(git -C "$SOURCE" rev-parse refs/heads/main)" = "$FROZEN" || exit 1
test "$(git --git-dir="$PRIVATE/private-backup.git" rev-parse refs/heads/main)" = "$FROZEN" || exit 1
test "$(git -C "$SOURCE" rev-list --count refs/heads/main)" = 3 || exit 1
test "$(git rev-list --count refs/heads/main)" -ge 2 || exit 1
git log --oneline refs/heads/main
```

The expected negative checks say `STOP` and return nonzero; the last checks
verify unchanged source, matching current tree, absent historical paths and
blob IDs, and surviving project history. Inspect the commit map under the
candidate's private `.git/filter-repo/` directory, then retain or discard the
whole laboratory privately. Never copy the synthetic clone to a public target.

## Separate web-ml scan

The maintainer performs this separately in the `web-ml` checkout; it does not filter that repository. Freeze its own verified main tip, check that no old or additional ref will be published, and scan exactly that commit graph into a separate private report. Run its own documented verification and recheck the tip before publication. An existing public destination needs a separate decision.

```sh
export WEB_ML_SOURCE='/absolute/path/to/private/web-ml'
export WEB_ML_TIP="$(git -C "$WEB_ML_SOURCE" rev-parse --verify 'refs/heads/main^{commit}')"
test -z "$(git -C "$WEB_ML_SOURCE" status --porcelain)" || exit 1
gitleaks git "$WEB_ML_SOURCE" --no-banner --redact=100 --report-format=json \
  --report-path "$PRIVATE/web-ml-secrets.json" --log-opts="$WEB_ML_TIP"
python3 -c 'import json,os,sys; p=os.path.join(os.environ["PRIVATE"],"web-ml-secrets.json"); sys.exit(0 if json.load(open(p)) == [] else 1)'
test "$(git -C "$WEB_ML_SOURCE" rev-parse refs/heads/main)" = "$WEB_ML_TIP" || exit 1
```

## Maintainer publication checklist

- [ ] Freeze and verify integrated `samata-ml/main`, retain the private full
      backup, and independently confirm the intended GitHub destination does not exist. Choose a source-code licence before public visibility.
- [ ] Review every tree and suspect artefact, classify aliases, complete the
      filter and exact-ref path/blob checks, inspect the commit map, and pass the
      redacted secret scan and normal verification in the candidate.
- [ ] For `web-ml`, preserve its existing history. Freeze its own `main`, scan
      that exact main-only history for secrets with a separate private redacted
      report, and run its own documented verification. Do not filter or merge it
      with the `samata-ml` candidate.
- [ ] Obtain separate publication permission. Publish only the verified clean
      `samata-ml` candidate's `main` and the separately verified `web-ml/main`.
      Share a commit-specific supervisor permalink to each review snapshot; optional
      milestone tags may be created only from verified published snapshots.
- [ ] Keep the private backup and audit evidence. Use the filtered candidate or
      a fresh public clone for future public work; never merge pre-filter refs.

No push or public repository creation is performed by this guide's
implementation. If a destination already contains published history, stop and
ask the maintainer for a separate remediation decision.
