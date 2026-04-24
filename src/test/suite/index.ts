import * as path from "path";
import Mocha from "mocha";

export const run = async (): Promise<void> => {
  const mocha = new Mocha({
    ui: "bdd",
    color: true
  });

  const testsRoot = path.resolve(__dirname);
  mocha.addFile(path.resolve(testsRoot, "commands.test.js"));
  mocha.addFile(path.resolve(testsRoot, "configuration.test.js"));
  // mocha.addFile(path.resolve(testsRoot, "lute.test.js"));

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
};
