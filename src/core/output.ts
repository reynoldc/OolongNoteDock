import * as vscode from "vscode";

let outputChannel: vscode.OutputChannel | undefined;

export const OUTPUT_CHANNEL_NAME = "OolongNoteDock";

export const getOutputChannel = (): vscode.OutputChannel => {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }
  return outputChannel;
};

export const disposeOutputChannel = (): void => {
  outputChannel?.dispose();
  outputChannel = undefined;
};

export const log = (message: string): void => {
  const channel = getOutputChannel();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] ${message}`);
};
