# Release Process

## Goals

- Use GitHub Releases as the canonical source of release artifacts.
- Require explicit version tags for production publishing.
- Avoid mutable single-file release assumptions.
- Preserve historical release artifacts and metadata.

## Proposed flow

1. Create a version tag such as v1.2.0.
2. GitHub Actions builds the Windows application.
3. Runtime binaries are bundled.
4. Installer and checksums are generated.
5. Release metadata is published to GitHub Releases.
6. KWL Nexus consumes release metadata through an authenticated API.

## Production rules

- Never overwrite old releases.
- Keep semantic versioning consistent.
- Publish only from explicit release tags.
- Verify signatures or checksums before enabling update installation.
