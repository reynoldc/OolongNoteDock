import * as os from "os";
import * as path from "path";
import { promises as fs } from "fs";
import { runTests } from "@vscode/test-electron";

const createTempWorkspace = async (): Promise<string> => {
  const base = path.join(os.tmpdir(), "oolong-note-dock-");
  return fs.mkdtemp(base);
};

const main = async (): Promise<void> => {
  const extensionDevelopmentPath = path.resolve(__dirname, "..", "..");
  const extensionTestsPath = path.resolve(__dirname, "smoke", "index");
  const workspacePath = await createTempWorkspace();
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "oolong-note-dock-smoke-")
  );
  const userDataDir = path.join(tempRoot, "user-data");
  const extensionsDir = path.join(tempRoot, "extensions");
  await fs.mkdir(userDataDir, { recursive: true });
  await fs.mkdir(extensionsDir, { recursive: true });

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
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
