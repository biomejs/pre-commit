#!/usr/bin/env node

const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs").promises;
const path = require("path");

const { DEFAULT_BRANCH, GITHUB_ACTOR, GITHUB_ACTOR_ID } = process.env;
const REPO_DIR = path.resolve(__dirname, "..", "..");
const PACKAGE_NAME = "@biomejs/biome";

async function main() {
  const missingVersions = await getMissingVersions();
  if (!missingVersions.length) {
    console.log("No new versions found");
    return;
  }

  await setGitConfig(missingVersions);
  for (const version of missingVersions) {
    console.log(getMessage(version));
    await updateFiles(version);
    await commitTag(version);
  }

  await mergePullRequest(missingVersions);
}

async function getMissingVersions() {
  const allVersions = await getAllVersions();
  const existingVersions = await getExistingVersions();
  const ignoredVersions = await getIgnoredVersions();
  const excludedVersions = new Set([...existingVersions, ...ignoredVersions]);
  return allVersions
    .filter((v) => !excludedVersions.has(v))
    .sort();
}

async function getAllVersions() {
  const allVersions = await getNodePackageVersions(PACKAGE_NAME);
  return allVersions.filter((v) => !v.includes("nightly")).sort();
}

async function getNodePackageVersions(packageName) {
  const { stdout } = await exec(`npm view ${packageName} --json`);
  const output = JSON.parse(stdout);
  return output.versions;
}

async function getIgnoredVersions() {
  const ignoreFile = path.join(REPO_DIR, "ignored-versions.txt");
  const ignores = await fs.readFile(ignoreFile, "utf8");
  return ignores
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

async function getExistingVersions() {
  const existingTags = await git("tag", "--list");
  return existingTags
    .split("\n")
    .map((t) => t.replace("v", "", 1))
    .sort();
}

function getMessage(version) {
  return `build(deps): bump ${PACKAGE_NAME} to ${version}`;
}

async function setGitConfig(versions) {
  const email = `${GITHUB_ACTOR_ID}+${GITHUB_ACTOR}@users.noreply.github.com`;

  await git("config", "user.name", GITHUB_ACTOR);
  await git("config", "user.email", email);
  await git("checkout", DEFAULT_BRANCH);
  await git("checkout", "-b", getBranchName(versions.at(-1)));
}

function getBranchName(version) {
  return `build/bump-${PACKAGE_NAME.replace("/", "-")}-${version}`;
}

async function updateFiles(version) {
  await updateReadme(version);
  await updatePackageJson(version);
  await exec("npm update --package-lock-only");
}

async function updateReadme(version) {
  const readmeFile = path.join(REPO_DIR, "README.md");
  const readme = await fs.readFile(readmeFile, "utf8");
  const newReadme = readme.replace(/rev:\s+\S+/i, `rev: v${version}`);
  await fs.writeFile(readmeFile, newReadme, "utf8");
}

async function updatePackageJson(version) {
  const packageJsonFile = path.join(REPO_DIR, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonFile, "utf8"));
  packageJson.dependencies[PACKAGE_NAME] = version;
  await fs.writeFile(
    packageJsonFile,
    JSON.stringify(packageJson, null, 2),
    "utf8"
  );
}

async function commitTag(version) {
  const tag = `v${version}`;
  const message = getMessage(version);

  await git("add", "README.md", "package.json", "package-lock.json");
  await git("commit", "--message", `"${message}"`);
  await git("tag", "--annotate", tag, "--message", `"${message}"`);
}

async function mergePullRequest(versions) {
  await git(
    "push",
    "--follow-tags",
    "--set-upstream",
    "origin",
    getBranchName(versions.at(-1))
  );
  await exec(`gh pr create --fill --title "${getMessage(versions.at(-1))}"`);
  await exec("gh pr merge --auto --merge --delete-branch");
}

async function git(...cmd) {
  const { stdout, stderr } = await exec(
    ["git", "-C", REPO_DIR, ...cmd].join(" ")
  );
  if (stderr) console.log(stderr);
  return stdout;
}

main();
