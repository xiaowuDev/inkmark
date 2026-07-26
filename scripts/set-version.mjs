import { readFile, rename, writeFile } from "node:fs/promises";

const version = process.env.APP_VERSION ?? process.argv[2];
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u;

if (!version || !SEMVER_PATTERN.test(version)) {
  throw new Error(
    "Provide a valid semantic version through APP_VERSION or the first argument.",
  );
}

async function writeAtomically(path, contents) {
  const temporaryPath = `${path}.inkmark-version`;
  await writeFile(temporaryPath, contents);
  await rename(temporaryPath, path);
}

async function updateJsonVersion(path) {
  const contents = await readFile(path, "utf8");
  const document = JSON.parse(contents);
  document.version = version;
  await writeAtomically(path, `${JSON.stringify(document, null, 2)}\n`);
}

async function updateCargoVersion(path) {
  const contents = await readFile(path, "utf8");
  const packageVersionPattern =
    /(^\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/mu;

  if (!packageVersionPattern.test(contents)) {
    throw new Error(`Could not find the package version in ${path}.`);
  }

  const updated = contents.replace(packageVersionPattern, `$1"${version}"`);
  await writeAtomically(path, updated);
}

await updateJsonVersion("package.json");
await updateJsonVersion("src-tauri/tauri.conf.json");
await updateCargoVersion("src-tauri/Cargo.toml");

console.log(`InkMark version set to ${version}.`);
