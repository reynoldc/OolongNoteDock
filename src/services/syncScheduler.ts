import * as vscode from 'vscode';
import { GitService } from './gitService';
import { log } from '../core/output';

export class SyncScheduler {
    private commitTimer: NodeJS.Timeout | undefined;
    private pullTimer: NodeJS.Timeout | undefined;
    private lastEditTime: number = Date.now();
    private disposables: vscode.Disposable[] = [];
    private enabled = false;
    private onStateChangeCallbacks: Array<(state: { enabled: boolean; busy: boolean }) => void> = [];
    private busy = false;

    constructor(
        private gitService: GitService,
        private notesRootUri: vscode.Uri
    ) {
        this.updateConfiguration();

        // Listen for configuration changes
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('oolongNoteDock.gitSync')) {
                this.updateConfiguration();
            }
        }));

        // Listen for file edits if needed
        this.disposables.push(vscode.workspace.onDidChangeTextDocument(e => {
            if (this.enabled) {
                this.onDocumentChanged(e);
            }
        }));
    }

    public onStateChange(cb: (state: { enabled: boolean; busy: boolean }) => void): void {
        this.onStateChangeCallbacks.push(cb);
        // Emit current state immediately
        cb({ enabled: this.enabled, busy: this.busy });
    }

    private emitState(): void {
        const state = { enabled: this.enabled, busy: this.busy };
        for (const cb of this.onStateChangeCallbacks) {
            try {
                cb(state);
            } catch {
                // ignore listener errors
            }
        }
    }

    private updateConfiguration() {
        const config = vscode.workspace.getConfiguration('oolongNoteDock.gitSync');
        this.enabled = config.get<boolean>('enabled', false);

        this.stop();

        if (this.enabled) {
            this.start();
        }
        this.emitState();
    }

    private start() {
        const config = vscode.workspace.getConfiguration('oolongNoteDock.gitSync');
        const commitInterval = config.get<number>('autoCommitInterval', 30) * 60 * 1000;
        const pullInterval = config.get<number>('autoPullInterval', 5) * 60 * 1000;
        const timingMode = config.get<string>('timingMode', 'afterLastEdit');

        log(`Starting SyncScheduler. Mode: ${timingMode}, Commit: ${commitInterval}ms, Pull: ${pullInterval}ms`);

        // Schedule Pull (Fixed interval usually)
        this.pullTimer = setInterval(() => {
            void this.triggerPull();
        }, pullInterval);

        // Schedule Commit
        if (timingMode === 'fixedInterval') {
            this.commitTimer = setInterval(() => {
                void this.triggerCommit();
            }, commitInterval);
        } else {
            // afterLastEdit: handled by onDocumentChanged and debounce
            // We check periodically if enough time has passed since last edit
            this.commitTimer = setInterval(() => {
                const now = Date.now();
                if (now - this.lastEditTime >= commitInterval) {
                    // Reset last edit time to prevent double commit immediately
                    // But wait, if we commit, we should probably wait for next edit to start counting again?
                    // Or just keep checking.
                    // Actually, for "afterLastEdit", it's a debounce.
                    // If user is editing continuously, we don't commit?
                    // Or we commit if idle for X minutes.
                    // Yes, usually "after last edit" means "idle for X minutes".
                    
                    // We need a flag to know if there are pending changes?
                    // For simplicity, we just trigger commit. GitService will handle empty commits (usually git won't commit if no changes).
                    
                    // To avoid repeated commits when idle, we can track if we already committed since last edit.
                    // But tracking that state is complex.
                    // Simple approach: triggerCommit. If git says "nothing to commit", fine.
                    void this.triggerCommit();
                    
                    // Reset time to avoid spamming commit every check interval
                    // But if we reset, we might delay next valid commit.
                    // Let's rely on `triggerCommit` to be safe and maybe the interval checking logic.
                    // Actually, if we use `setTimeout` (debounce) it's cleaner.
                }
            }, 10000); // Check every 10 seconds
        }
    }

    private stop() {
        if (this.commitTimer) {
            clearInterval(this.commitTimer);
            this.commitTimer = undefined;
        }
        if (this.pullTimer) {
            clearInterval(this.pullTimer);
            this.pullTimer = undefined;
        }
    }

    private onDocumentChanged(e: vscode.TextDocumentChangeEvent) {
        // Only care about files in our notes root
        if (e.document.uri.fsPath.startsWith(this.notesRootUri.fsPath)) {
            this.lastEditTime = Date.now();
            
            // If we are in 'afterLastEdit' mode using debounce approach implemented in start(),
            // we just updated the timestamp.
            
            // Alternative: real debounce
            // If using setTimeout, we would clear and set new timeout here.
            const config = vscode.workspace.getConfiguration('oolongNoteDock.gitSync');
            const timingMode = config.get<string>('timingMode', 'afterLastEdit');
            
            if (timingMode === 'afterLastEdit') {
                // If we were using setInterval check, updating lastEditTime is enough.
                // But setInterval check has a resolution.
                // Let's stick to the setInterval check in `start()` for simplicity and robustness.
            }
        }
    }

    private async triggerCommit() {
        const repo = this.gitService.getRepository(this.notesRootUri);
        if (repo) {
            this.busy = true;
            this.emitState();
            try {
                await this.gitService.commitAndSync(repo);
            } finally {
                this.busy = false;
                this.emitState();
            }
            // Reset lastEditTime to avoid immediate re-trigger in loop
            this.lastEditTime = Date.now();
        }
    }

    private async triggerPull() {
        const repo = this.gitService.getRepository(this.notesRootUri);
        if (repo) {
            this.busy = true;
            this.emitState();
            try {
                await this.gitService.pull(repo);
            } finally {
                this.busy = false;
                this.emitState();
            }
        }
    }

    public dispose() {
        this.stop();
        this.disposables.forEach(d => d.dispose());
    }
}

export const editGitignore = async (workspaceUri: vscode.Uri) => {
    const gitignorePath = vscode.Uri.joinPath(workspaceUri, '.gitignore');
    
    try {
        await vscode.workspace.fs.stat(gitignorePath);
    } catch {
        // File doesn't exist, create it
        const defaultContent = new TextEncoder().encode('.DS_Store\n.trash\n');
        await vscode.workspace.fs.writeFile(gitignorePath, defaultContent);
        log('Created default .gitignore');
    }

    const doc = await vscode.workspace.openTextDocument(gitignorePath);
    await vscode.window.showTextDocument(doc);
};
