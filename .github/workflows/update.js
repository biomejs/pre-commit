const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs").promises;
const path = require("path");

const REPO_DIR = path.resolve(__dirname, "..", "..");
const PACKAGE_NAME = "@biomejs/biome";

async function main() {
  try {
    const missingTags = await getMissingTags();
    if (!missingTags.length) {
      console.log("No new versions found");
      return 0;
    }

    for (const tag of missingTags) {
      console.log(`Updating to ${tag}`);
      await updateFiles(tag);
      await stageCommitAndTag(tag);
    }
    return 0;
  } catch (error) {
    console.error("An error occurred:", error);
    process.exit(1);
  }
}

async function getMissingTags() {
  const allTags = await getAllTags();
  const existingTags = await getExistingTags();
  return allTags.filter((tag) => !existingTags.includes(tag)).sort();
}

async function getAllTags() {
  const allVersions = await getNodePackageVersions(PACKAGE_NAME);
  return allVersions
    .filter((v) => !v.includes("nightly"))
    .map((v) => `v${v}`)
    .sort();
}

async function getExistingTags() {
  const existingTags = await git("tag", "--list");
  return existingTags
    .split("\n")
    .filter((t) => t.startsWith("v"))
    .sort();
}

async function getNodePackageVersions(packageName) {
  const cmd = `npm view ${packageName} --json`;
  const { stdout } = await exec(cmd);
  const output = JSON.parse(stdout);
  return output.versions;
}

async function updateFiles(tag) {
  const version = tag.replace("v", "", 1);
  await replaceInReadme(version);
  await replaceInPackageJson(version);
}

async function replaceInReadme(version) {
  const readmeFile = path.join(REPO_DIR, "README.md");
  const readme = await fs.readFile(readmeFile, "utf8");
  const currentVersion = await getCurrentVersion();
  const newReadme = readme.replace(currentVersion, version);
  await fs.writeFile(readmeFile, newReadme, "utf8");
}

async function getCurrentVersion() {
  const packageJsonFile = path.join(REPO_DIR, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonFile, "utf8"));
  return packageJson.dependencies[PACKAGE_NAME];
}

async function replaceInPackageJson(version) {
  const packageJsonFile = path.join(REPO_DIR, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonFile, "utf8"));
  packageJson.dependencies[PACKAGE_NAME] = version;
  await fs.writeFile(
    packageJsonFile,
    JSON.stringify(packageJson, null, 2),
    "utf8"
  );
}

async function stageCommitAndTag(tag) {
  await git("add", "package.json", "README.md");
  await git("commit", "-m", `"MAINT: upgrade to ${PACKAGE_NAME} ${tag}"`);
  await git("tag", tag);
}

async function git(...cmd) {
  const { stdout } = await exec(["git", "-C", REPO_DIR, ...cmd].join(" "));
  return stdout;
}

main();
