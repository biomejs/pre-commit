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

  await setGitConfig();
  for (const version of missingVersions) {
    console.log(`Updating to ${PACKAGE_NAME} ${version}`);
    await updateFiles(version);
    await commitAndPushTag(version);
  }

  await git("push", "origin", `HEAD:refs/heads/${DEFAULT_BRANCH}`);
}

async function getMissingVersions() {
  const allVersions = await getAllVersions();
  const existingVersions = await getExistingVersions();
  return allVersions.filter((v) => !existingVersions.includes(v)).sort();
}

async function getAllVersions() {
  const allVersions = await getNodePackageVersions(PACKAGE_NAME);
  return allVersions.filter((v) => !v.includes("nightly")).sort();
}

async function getExistingVersions() {
  const existingTags = await git("tag", "--list");
  return existingTags
    .split("\n")
    .map((t) => t.replace("v", "", 1))
    .sort();
}

async function setGitConfig() {
  const email = `${GITHUB_ACTOR_ID}+${GITHUB_ACTOR}@users.noreply.github.com`;
  await git("config", "user.name", GITHUB_ACTOR);
  await git("config", "user.email", email);
  await git("checkout", DEFAULT_BRANCH);
}

async function getNodePackageVersions(packageName) {
  const { stdout } = await exec(`npm view ${packageName} --json`);
  const output = JSON.parse(stdout);
  return output.versions;
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

async function commitAndPushTag(version) {
  const tag = `v${version}`;
  await git("add", "README.md", "package.json", "package-lock.json");
  await git("commit", "-m", `"MAINT: upgrade to ${PACKAGE_NAME} ${version}"`);
  await git("tag", tag);
  await git("push", "origin", tag);
}

async function git(...cmd) {
  const { stdout, stderr } = await exec(
    ["git", "-C", REPO_DIR, ...cmd].join(" ")
  );
  if (stderr) console.log(stderr);
  return stdout;
}

main();
