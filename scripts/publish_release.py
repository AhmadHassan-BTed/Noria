"""
Noria GitHub Release Publisher
--------------------------------
Reads docs/RELEASE_NOTES_v<version>.md, creates a GitHub release
with the correct tag, uses the notes as the body, and uploads
dist/Noria.exe as the release asset.

Usage:
    python scripts/publish_release.py              # uses version from package.json
    python scripts/publish_release.py --version v1.0.0
    python scripts/publish_release.py --version v1.0.0 --draft
    python scripts/publish_release.py --version v1.0.0 --prerelease
"""

import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def resolve_version(explicit: str | None) -> str:
    if explicit:
        return explicit.lstrip("v")
    pkg = os.path.join(ROOT, "package.json")
    with open(pkg, "r", encoding="utf-8") as f:
        return json.load(f)["version"]


def find_release_notes(version: str) -> str:
    """Return path to the release notes for the given version."""
    candidates = [
        os.path.join(ROOT, "docs", f"RELEASE_NOTES_v{version}.md"),
        os.path.join(ROOT, "docs", f"RELEASE_NOTES_{version}.md"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    sys.exit(
        f"[ERROR] Release notes not found. Looked for:\n"
        + "\n".join(f"  {c}" for c in candidates)
    )


def find_exe() -> str:
    exe = os.path.join(ROOT, "dist", "Noria.exe")
    if not os.path.exists(exe):
        sys.exit(
            f"[ERROR] Noria.exe not found at: {exe}\n"
            "Run 'python scripts/build_exe.py' first."
        )
    return exe


def run(cmd: list[str], **kwargs):
    print(f"  > {' '.join(cmd)}")
    result = subprocess.run(cmd, **kwargs)
    if result.returncode != 0:
        sys.exit(f"[ERROR] Command failed with exit code {result.returncode}")
    return result


def main():
    parser = argparse.ArgumentParser(description="Publish a Noria GitHub Release")
    parser.add_argument("--version", help="Version tag e.g. v1.0.0 (default: reads package.json)")
    parser.add_argument("--draft", action="store_true", help="Create as a draft release")
    parser.add_argument("--prerelease", action="store_true", help="Mark as pre-release")
    parser.add_argument("--no-exe", action="store_true", help="Skip uploading Noria.exe")
    args = parser.parse_args()

    version = resolve_version(args.version)
    tag = f"v{version}"

    print(f"\n{'='*52}")
    print(f"  Noria Release Publisher")
    print(f"  Version : {tag}")
    print(f"{'='*52}\n")

    notes_path = find_release_notes(version)
    print(f"[1/3] Release notes: {os.path.relpath(notes_path, ROOT)}")

    exe_path = None
    if not args.no_exe:
        exe_path = find_exe()
        print(f"[2/3] Executable   : {os.path.relpath(exe_path, ROOT)}")
    else:
        print("[2/3] Skipping exe upload (--no-exe)")

    print(f"[3/3] Creating GitHub release {tag}...\n")

    # Build gh release create command
    cmd = [
        "gh", "release", "create", tag,
        "--title", f"Noria {tag}",
        "--notes-file", notes_path,
    ]

    if args.draft:
        cmd.append("--draft")
    if args.prerelease:
        cmd.append("--prerelease")

    # Attach exe as asset (with a clean display label)
    if exe_path:
        cmd.append(f"{exe_path}#Noria.exe")

    run(cmd, cwd=ROOT)

    print(f"\n[OK] Release {tag} published successfully!")
    print(f"     https://github.com/AhmadHassan-BTed/Noria/releases/tag/{tag}\n")


if __name__ == "__main__":
    main()
