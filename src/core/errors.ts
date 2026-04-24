import * as vscode from "vscode";
import { getOutputChannel } from "./output";
import { t } from "./localization";

export type CommandHandler<TArgs extends unknown[]> = (
  ...args: TArgs
) => Promise<void>;

export const withErrorHandling = <TArgs extends unknown[]>(
  commandName: string,
  handler: CommandHandler<TArgs>
): CommandHandler<TArgs> => {
  return async (...args: TArgs): Promise<void> => {
    try {
      await handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const outputChannel = getOutputChannel();
      outputChannel.appendLine(`[${commandName}] ${message}`);
      outputChannel.show(true);
      await vscode.window.showErrorMessage(
        t("error.commandFailed", commandName, message)
      );
    }
  };
};
