# Git Auto Sync Functional Design

## 1. Overview
The **Git Auto Sync** feature allows OolongNoteDock users to automatically back up and synchronize their notes using VS Code's built-in Git capabilities. This feature is designed to be unobtrusive, configurable, and robust.

## 2. User Requirements
1.  **Enable/Disable Switch**: Users can toggle the auto-sync feature on or off globally.
2.  **Separate Intervals**:
    *   **Auto Commit & Sync**: Interval for committing local changes and pushing/pulling.
    *   **Auto Pull**: Interval for pulling remote changes (to stay up-to-date with other devices).
    *   **Unit**: Minutes.
3.  **Timing Modes**:
    *   **From Last Edit**: Timer starts/resets after the last file edit (debounce mechanism).
    *   **From Last Commit**: Timer runs on a fixed interval since the last successful commit.
4.  **Gitignore Management**:
    *   Users can edit `.gitignore` via the extension settings/command.
    *   If `.gitignore` is missing, a default one is created automatically (ignoring `.DS_Store` and `.trash`).

## 3. Configuration Settings (`package.json`)

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `oolongNoteDock.gitSync.enabled` | `boolean` | `false` | Enable/Disable Git Auto Sync. |
| `oolongNoteDock.gitSync.autoCommitInterval` | `number` | `10` | Interval (in minutes) for auto commit and sync. |
| `oolongNoteDock.gitSync.autoPullInterval` | `number` | `5` | Interval (in minutes) for auto pull. |
| `oolongNoteDock.gitSync.timingMode` | `enum` | `afterLastEdit` | `afterLastEdit` (debounce) or `fixedInterval` (loop). |

## 4. Technical Architecture

### 4.1 Git Service (`GitService`)
*   **Dependencies**: `vscode.extensions.getExtension('vscode.git')`.
*   **Responsibilities**:
    *   Detect if the current workspace is a Git repository.
    *   **Commit & Sync**:
        1.  `git add .`
        2.  `git commit -m "Auto save: <timestamp>"`
        3.  `git pull --rebase` (to handle simple conflicts automatically)
        4.  `git push`
    *   **Pull**: `git pull`.
    *   **Error Handling**: Notify user on merge conflicts or auth failures.

### 4.2 Sync Scheduler (`SyncScheduler`)
*   **Responsibilities**:
    *   Manage timers (`NodeJS.Timeout`) for Commit/Sync and Pull.
    *   **Mode Handling**:
        *   *Fixed Interval*: `setInterval` loops.
        *   *After Last Edit*: Listen to `vscode.workspace.onDidChangeTextDocument`. Reset the "Commit Timer" on every event.
*   **Lifecycle**:
    *   Start on extension activation (if enabled).
    *   Restart when configuration changes.
    *   Stop on deactivation.

### 4.3 Gitignore Manager
*   **Command**: `oolongNoteDock.editGitignore`
*   **Logic**:
    *   Check for `.gitignore` in workspace root.
    *   **If missing**: Create with default content:
        ```gitignore
        .DS_Store
        .trash
        ```
    *   **Action**: Open the file in VS Code editor.

## 5. UI/UX Flow
1.  **Settings**: User goes to VS Code Settings -> Extensions -> OolongNoteDock to configure intervals and mode.
2.  **Gitignore**: User runs command `> OolongNoteDock: Edit .gitignore` to manage exclusions.
3.  **Status**: (Optional) StatusBarItem showing "Syncing..." state.
4.  **Notifications**:
    *   Info: "Git Auto Sync enabled."
    *   Error: "Git Sync failed: Merge conflict detected."

## 6. Edge Cases
*   **No Git Repo**: Feature silently disables or warns once.
*   **Dirty State**: If files are unsaved in VS Code, `git add` might not pick them up. *Decision*: We rely on the file on disk. Users should have Auto Save enabled in VS Code for best results, but we won't force it.
*   **Conflicts**: If `git pull --rebase` fails, stop auto-sync and alert user to resolve manually.

## 7. Implementation Plan
1.  Add configuration to `package.json`.
2.  Implement `GitService` class.
3.  Implement `SyncScheduler` class.
4.  Implement `editGitignore` command.
5.  Wire everything in `extension.ts`.
