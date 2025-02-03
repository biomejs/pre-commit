#!/usr/bin/env python

"""Run with https://docs.astral.sh/uv/guides/scripts:

.. code-block:: shell
    uv run --script .github/workflows/update.py
"""

import json
import subprocess
from pathlib import Path

REPO_DIR = Path(__file__).parent.parent.parent.absolute()
PACKAGE_NAME = "@biomejs/biome"


def main() -> int:
    tags = get_existing_tags()
    versions = get_all_versions()
    missing_tags = get_missing_tags(tags, versions)
    if not missing_tags:
        print("No new versions found")
        return 0
    for tag in sorted(missing_tags):
        print(f"Updating to {tag}")
        update_files(tag)
        stage_commit_and_tag(tag)
    return 0


def get_existing_tags() -> list[str]:
    tags = git("tag", "--list").splitlines()
    return sorted(t for t in tags if t.startswith("v"))


def get_all_versions() -> list[str]:
    all_versions = _get_node_package_versions(PACKAGE_NAME)
    all_versions = [v for v in all_versions if "nightly" not in v]
    return sorted(all_versions)


def get_missing_tags(existing_tags: list[str], all_versions: list[str]) -> set[str]:
    tags = set(existing_tags)
    versions = set(all_versions)
    expected_tags = {f"v{t}" for t in versions}
    return expected_tags - tags


def _get_node_package_versions(package_name: str) -> list[str]:
    cmd = ("npm", "view", package_name, "--json")
    output = json.loads(subprocess.check_output(cmd))
    return output["versions"]


def update_files(tag: str) -> None:
    version = to_version(tag)
    _replace_in_readme(version)
    _replace_in_package_json(version)


def to_version(tag: str) -> str:
    return tag.replace("v", "", 1)


def _replace_in_readme(version: str) -> None:
    readme_file = Path(REPO_DIR, "README.md")
    readme = readme_file.read_text()
    current_version = __get_current_version()
    new_readme = readme.replace(current_version, version)
    readme_file.write_text(new_readme)


def __get_current_version() -> str:
    package = json.loads(Path(REPO_DIR, "package.json").read_text())
    return package["dependencies"][PACKAGE_NAME]


def _replace_in_package_json(version: str) -> None:
    package_json = Path(REPO_DIR, "package.json")
    package = json.loads(package_json.read_text())
    package["dependencies"][PACKAGE_NAME] = version
    package_json.write_text(json.dumps(package, indent=2))


def stage_commit_and_tag(tag: str) -> None:
    git("add", "package.json", "README.md")
    git("commit", "-m", f"MAINT: upgrade to {PACKAGE_NAME} {tag}")
    git("tag", tag)


def git(*cmd: str) -> str:
    output = subprocess.check_output(("git", "-C", REPO_DIR) + cmd)
    return output.decode()


if __name__ == "__main__":
    raise SystemExit(main())
