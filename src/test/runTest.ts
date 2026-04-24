import * as os from "os";
import * as path from "path";
import { promises as fs } from "fs";
import { runTests } from "@vscode/test-electron";

const main = async (): Promise<void> => {
  const extensionDevelopmentPath = path.resolve(__dirname, "..", "..");
  const extensionTestsPath = path.resolve(__dirname, "suite", "index");
  const workspacePath = path.resolve(
    __dirname,
    "..",
    "..",
    "src",
    "test",
    "workspace"
  );
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "oolong-note-dock-tests-")
  );
  const userDataDir = path.join(tempRoot, "user-data");
  const extensionsDir = path.join(tempRoot, "extensions");
  await fs.mkdir(userDataDir, { recursive: true });
  await fs.mkdir(extensionsDir, { recursive: true });
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf("--vscodeVersion");
  const version =
    versionIndex >= 0 && args.length > versionIndex + 1
      ? args[versionIndex + 1]
      : undefined;

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    version,
    launchArgs: [
      workspacePath,
      "--disable-extensions",
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir
    ]
  });
};

void main();
