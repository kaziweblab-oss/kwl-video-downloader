#!/usr/bin/env python3
"""Generate Tauri updater `latest.json` from CI-collected release artifacts.

Reads every file under `artifacts/` (download-artifact merge output),
pairs each updater bundle with its `.sig` signature file, and writes
`latest.json` in the static-JSON format the updater plugin expects:

  {version, notes, pub_date, platforms: {target: {signature, url}}}

Platform keys follow OS-ARCH (`windows-x86_64`, `linux-x86_64`,
`darwin-aarch64`, ...). Only complete pairs (bundle + matching .sig) are
included; anything incomplete is skipped with a warning. Exits non-zero
when no platform at all could be assembled (fail-fast beats an empty file).

Updater bundle mapping (Tauri v2):
  Windows -> NSIS `*-x64-setup.exe` (MSI also works; NSIS is standard)
  Linux   -> `*amd64.AppImage`
  macOS   -> `*.app.tar.gz` (the updater CANNOT use .dmg)
Android is intentionally excluded (mobile updates ship via store/APK).
"""

import datetime
import json
import pathlib
import sys

REPO = "kaziweblab-oss/kwl-video-downloader"


def release_asset_name(local_name: str) -> str:
    # softprops/action-gh-release sanitizes upload names: spaces become dots
    # (e.g. `KWL Video Downloader_1.0.6_x64-setup.exe` is published as
    # `KWL.Video.Downloader_1.0.6_x64-setup.exe`). The updater URL must use
    # the PUBLISHED name or downloads 404.
    return local_name.replace(" ", ".")


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1]:
        print("usage: generate-latest-json.py <tag>   (e.g. v1.0.4)", file=sys.stderr)
        return 2
    tag = sys.argv[1]
    version = tag[1:] if tag.startswith("v") else tag

    art = pathlib.Path("artifacts")
    files = {}
    if art.is_dir():
        for p in art.rglob("*"):
            if p.is_file() and p.name not in files:
                files[p.name] = p

    def sig_of(bundle_name: str):
        sig = files.get(bundle_name + ".sig")
        if sig is None:
            return None
        try:
            text = sig.read_text(encoding="utf-8", errors="strict").strip()
        except OSError:
            return None
        return text or None

    def pick(*suffixes):
        # Separator-agnostic: real CI names use spaces/underscores/dots
        # (e.g. `KWL.Video.Downloader_1.0.5_x64-setup.exe`), so suffixes
        # must NOT assume a leading dash.
        cands = sorted(
            n for n in files
            if not n.endswith(".sig") and any(n.lower().endswith(s.lower()) for s in suffixes)
        )
        return cands[0] if cands else None

    def darwin_pick(arch_markers):
        cands = sorted(
            n for n in files
            if n.endswith(".app.tar.gz")
            and not n.endswith(".sig")
            and any(m in n for m in arch_markers)
        )
        return cands[0] if cands else None

    platforms = {}

    win = pick("x64-setup.exe")
    if win is None:
        win = pick("x64_en-US.msi", ".msi")
    if win and sig_of(win):
        platforms["windows-x86_64"] = {
            "signature": sig_of(win),
            "url": f"https://github.com/{REPO}/releases/download/{tag}/{release_asset_name(win)}",
        }
    elif win:
        print(f"warn: {win} has no matching .sig, skipped", file=sys.stderr)

    lin = pick("amd64.AppImage")
    if lin and sig_of(lin):
        platforms["linux-x86_64"] = {
            "signature": sig_of(lin),
            "url": f"https://github.com/{REPO}/releases/download/{tag}/{release_asset_name(lin)}",
        }
    elif lin:
        print(f"warn: {lin} has no matching .sig, skipped", file=sys.stderr)

    for key, markers in (("darwin-aarch64", ("aarch64", "arm64")),
                         ("darwin-x86_64", ("x86_64", "x64"))):
        mac = darwin_pick(markers)
        if mac and sig_of(mac):
            # avoid double-claiming one file for both arches
            if any(v["url"].endswith("/" + mac) for v in platforms.values()):
                continue
            platforms[key] = {
                "signature": sig_of(mac),
                "url": f"https://github.com/{REPO}/releases/download/{tag}/{release_asset_name(mac)}",
            }
        elif mac:
            print(f"warn: {mac} has no matching .sig, skipped", file=sys.stderr)

    if not platforms:
        print("error: no complete updater platform (bundle + .sig) found", file=sys.stderr)
        return 1

    pub_date = (
        datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )
    doc = {
        "version": version,
        "notes": f"KWL Video Downloader {version}",
        "pub_date": pub_date,
        "platforms": platforms,
    }
    pathlib.Path("latest.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print("wrote latest.json platforms: " + ", ".join(sorted(platforms)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
