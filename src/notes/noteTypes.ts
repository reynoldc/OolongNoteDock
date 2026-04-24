import * as vscode from "vscode";

export type NoteNodeType = "folder" | "file" | "image";

export interface NoteNode {
  uri: vscode.Uri;
  name: string;
  type: NoteNodeType;
  children: NoteNode[];
}

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico",
]);

export function isImageFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase());
}
