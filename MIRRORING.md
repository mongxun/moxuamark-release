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

## Reliable release path

Create the GitHub release as a **draft**, upload both assets and verify their sizes/checksums first. Publish only after the assets are complete.

The GitHub-hosted `ubuntu-latest` route to Gitee's attachment endpoint repeatedly timed out on the ~50 MB installer. Use the local, China-network path for production mirroring:

```powershell
gitee-release assets upload <installer-path> --target <version-without-v>
gitee-release assets upload <SHA256SUMS.txt-path> --target <version-without-v>
```

The local CLI configuration stores the repository-scoped token on the developer machine. AI release automation must use this configured CLI, then download the public Gitee asset and verify SHA-256 again before updating the website.

The GitHub Actions workflow remains available only as a manual fallback. Automatic `release` triggers are disabled so they cannot create empty or unverified mirrors. Do not enable them unless the cloud upload path has passed an end-to-end test.

v0.52.14 was successfully uploaded through this local path, downloaded publicly, and verified against GitHub's SHA-256.
