# Gitee release mirroring

GitHub Releases remains the primary release channel. The workflow in `.github/workflows/gitee-mirror.yml` mirrors each published release to:

- Public mirror: <https://gitee.com/scotttttttmr/moxuamark-release>
- Gitee owner: `scotttttttmr`
- Gitee repository: `moxuamark-release`

## One-time setup

1. Create a Gitee personal access token with repository write permission.
2. Store it as the `GITEE_TOKEN` secret in the GitHub `mongxun/moxuamark-release` repository.
3. Ensure the Gitee repository has a `main` branch so releases can target it.

Never put the Gitee token in source files, commit logs, issues, or chat.

## Automatic operation

Publishing a GitHub release triggers the workflow. It:

1. Downloads the installer and `SHA256SUMS.txt` from the GitHub release.
2. Verifies the checksum before uploading.
3. Creates or reuses the matching Gitee release.
4. Uploads new assets and skips unchanged assets.
5. Downloads the public Gitee assets and verifies their checksums again.

To mirror an existing release manually, run **Actions → Mirror release to Gitee → Run workflow** and enter its tag.
