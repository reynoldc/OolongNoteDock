import * as vscode from 'vscode';
import { log } from '../core/output';
import { t } from '../core/localization';
import { execFile } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GitRepository {
    rootUri: vscode.Uri;
    state: {
        onDidChange: vscode.Event<void>;
        workingTreeChanges?: Array<{ uri: vscode.Uri }>;
        untrackedChanges?: Array<{ uri: vscode.Uri }>;
        indexChanges?: Array<{ uri: vscode.Uri }>;
    };
    add(paths: string[]): Promise<void>;
    commit(message: string): Promise<void>;
    pull(remote?: string, branch?: string, options?: { rebase?: boolean }): Promise<void>;
    push(remote?: string, branch?: string): Promise<void>;
    status(): Promise<void>;
}

export interface GitExtension {
    getAPI(version: number): GitAPI;
}

export interface GitAPI {
    repositories: GitRepository[];
    onDidOpenRepository: vscode.Event<GitRepository>;
    onDidCloseRepository: vscode.Event<GitRepository>;
}

export class GitService {
    private gitExtension: vscode.Extension<GitExtension> | undefined;
    private gitApi: GitAPI | undefined;
    private initializing: Promise<void> | undefined;
    private syncingCount = 0;

    constructor() {
        void this.initialize();
    }

    private async initialize(): Promise<void> {
        if (this.initializing) {
            return this.initializing;
        }

        this.initializing = (async () => {
            this.gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!this.gitExtension) {
                log('Git extension not found');
                return;
            }

            try {
                await this.gitExtension.activate();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                log(`Git extension activate failed: ${message}`);
                return;
            }

            const gitExtension = this.gitExtension.exports;
            if (!gitExtension) {
                log('Git extension API unavailable');
                return;
            }

            this.gitApi = gitExtension.getAPI(1);
        })();

        return this.initializing;
    }

    public getRepository(resource: vscode.Uri): GitRepository | undefined {
        if (!this.gitApi) {
            return undefined;
        }
        // Simple strategy: return the first repository that contains the resource
        // or just the first repository if resource is not specific (assuming single repo workspace for now)
        return this.gitApi.repositories.find(r => resource.fsPath.startsWith(r.rootUri.fsPath));
    }

    public async commitAndSync(repo: GitRepository): Promise<void> {
        const repoPath = repo.rootUri.fsPath;
        await this.updateSyncing(1);
        try {
            log('Starting Auto Sync: Commit and Push...');
            await this.commitAndSyncWithApi(repo);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Auto Sync Error: ${message}`);
            if (message.includes('t.replace is not a function')) {
                try {
                    await this.commitAndSyncWithCli(repoPath);
                    return;
                } catch (cliError: unknown) {
                    const cliMessage = cliError instanceof Error ? cliError.message : String(cliError);
                    log(`Auto Sync CLI Error: ${cliMessage}`);
                    void vscode.window.showErrorMessage(t("error.gitSyncFailed", cliMessage));
                    return;
                }
            }
            void vscode.window.showErrorMessage(t("error.gitSyncFailed", message));
        } finally {
            await this.updateSyncing(-1);
        }
    }

    private async commitAndSyncWithApi(repo: GitRepository): Promise<void> {
        await repo.status();
        const working = repo.state.workingTreeChanges ?? [];
        const untracked = repo.state.untrackedChanges ?? [];
        const index = repo.state.indexChanges ?? [];
        const resources = [...working, ...untracked].map(change => change.uri.fsPath);
        const repoPath = repo.rootUri.fsPath;
        const statusEntries = await this.getStatusEntries(repoPath);

        if (resources.length === 0 && index.length === 0) {
            log('Auto Sync: No changes to commit.');
            return;
        }

        if (resources.length > 0) {
            await repo.add(resources);
        }

        const date = new Date().toLocaleString();
        const config = vscode.workspace.getConfiguration('oolongNoteDock.gitSync');
        const messageTemplate = config.get<string>('commitMessageTemplate', 'Auto save: ${date}');
        const message = messageTemplate.replace('${date}', date);
        
        await repo.commit(message);

        await repo.pull(undefined, undefined, { rebase: true });
        await repo.push();

        const synced = this.formatFileList(statusEntries, repoPath);
        log(`Auto Sync: Completed successfully. Files: ${synced}`);
        void vscode.window.showInformationMessage(t("info.gitSyncCommitted", synced));
    }

    private async commitAndSyncWithCli(repoPath: string): Promise<void> {
        log('Auto Sync: Falling back to CLI.');
        const status = await this.runGit(repoPath, ['status', '--porcelain']);
        if (!status.stdout.trim()) {
            log('Auto Sync: No changes to commit.');
            return;
        }
        const statusEntries = this.parseGitStatusEntries(status.stdout, repoPath);

        await this.runGit(repoPath, ['add', '.']);
        const date = new Date().toLocaleString();
        const config = vscode.workspace.getConfiguration('oolongNoteDock.gitSync');
        const messageTemplate = config.get<string>('commitMessageTemplate', 'Auto save: ${date}');
        const message = messageTemplate.replace('${date}', date);

        await this.runGit(repoPath, ['commit', '-m', message]);
        await this.runGit(repoPath, ['pull', '--rebase']);
        await this.runGit(repoPath, ['push']);
        const synced = this.formatFileList(statusEntries, repoPath);
        log(`Auto Sync: Completed successfully. Files: ${synced}`);
        void vscode.window.showInformationMessage(t("info.gitSyncCommitted", synced));
    }

    private async runGit(repoPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
        try {
            const result = await execFileAsync('git', args, { cwd: repoPath });
            return {
                stdout: String(result.stdout ?? ''),
                stderr: String(result.stderr ?? '')
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(message);
        }
    }

    public async pull(repo: GitRepository): Promise<void> {
        const repoPath = repo.rootUri.fsPath;
        await this.updateSyncing(1);
        try {
            log('Starting Auto Pull...');
            await repo.pull();
            const pulledEntries = await this.getPulledEntries(repoPath);
            if (pulledEntries.length === 0) {
                log('Auto Pull: Completed successfully. No remote changes.');
                return;
            }
            const synced = this.formatFileList(pulledEntries, repoPath);
            log(`Auto Pull: Completed successfully. Files: ${synced}`);
            void vscode.window.showInformationMessage(t("info.gitSyncPulled", synced));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Auto Pull Error: ${message}`);
             // Silent failure for pull might be better, or just log
        } finally {
            await this.updateSyncing(-1);
        }
    }

    private formatFileList(
        items: Array<{ status: "M" | "+" | "-"; path: string }>,
        repoPath: string
    ): string {
        const normalized = items
            .map(item => ({
                status: item.status,
                path: path.relative(repoPath, item.path).replace(/\\/g, '/')
            }))
            .filter(item => Boolean(item.path));
        const unique = new Map<string, "M" | "+" | "-">();
        normalized.forEach(item => {
            if (!unique.has(item.path)) {
                unique.set(item.path, item.status);
            }
        });
        return Array.from(unique.entries())
            .map(([filePath, status], index) => `${index + 1}. ${status}:${filePath}`)
            .join("\n");
    }

    private parseGitStatusEntries(
        stdout: string,
        repoPath: string
    ): Array<{ status: "M" | "+" | "-"; path: string }> {
        const lines = stdout.split(/\r?\n/).filter(line => line.trim());
        return lines.map(line => {
            const statusPart = line.slice(0, 2);
            const filePart = line.slice(3).trim();
            const filePath = filePart.includes("->")
                ? filePart.split("->").pop()?.trim() ?? filePart
                : filePart;
            let status: "M" | "+" | "-";
            if (statusPart.includes("D")) {
                status = "-";
            } else if (statusPart.includes("A") || statusPart.includes("?")) {
                status = "+";
            } else {
                status = "M";
            }
            return { status, path: path.resolve(repoPath, filePath) };
        });
    }

    private async getStatusEntries(
        repoPath: string
    ): Promise<Array<{ status: "M" | "+" | "-"; path: string }>> {
        const status = await this.runGit(repoPath, ['status', '--porcelain']);
        if (!status.stdout.trim()) {
            return [];
        }
        return this.parseGitStatusEntries(status.stdout, repoPath);
    }

    private async getPulledEntries(
        repoPath: string
    ): Promise<Array<{ status: "M" | "+" | "-"; path: string }>> {
        try {
            const result = await this.runGit(repoPath, ['diff', '--name-status', 'HEAD@{1}..HEAD']);
            const lines = result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            return lines.map(line => {
                const [rawStatus, ...rest] = line.split(/\s+/);
                const statusCode = rawStatus?.trim() ?? "";
                let status: "M" | "+" | "-";
                if (statusCode.startsWith("D")) {
                    status = "-";
                } else if (statusCode.startsWith("A")) {
                    status = "+";
                } else {
                    status = "M";
                }
                const filePath = rest[rest.length - 1] ?? "";
                return { status, path: path.resolve(repoPath, filePath) };
            });
        } catch {
            return [];
        }
    }

    private async updateSyncing(delta: number): Promise<void> {
        const previous = this.syncingCount;
        const next = Math.max(0, previous + delta);
        this.syncingCount = next;
        if (previous === 0 && next > 0) {
            await vscode.commands.executeCommand("setContext", "oolongNoteDock.syncing", true);
            return;
        }
        if (previous > 0 && next === 0) {
            await vscode.commands.executeCommand("setContext", "oolongNoteDock.syncing", false);
        }
    }
}
