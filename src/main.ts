import { Plugin, TAbstractFile } from 'obsidian';

import { FolderTimeCache } from './folder-time';
import { FileExplorerPatch } from './patch-file-explorer';
import { parseSettings, settingsForSave } from './settings';
import { MixedExplorerSortSettingTab } from './settings-tab';
import {
	isFolderTimeMode,
	type FolderTimeMode,
	type MixedExplorerSortSettings,
} from './types';

export default class MixedExplorerSortPlugin extends Plugin {
	settings!: MixedExplorerSortSettings;
	folderTimes!: FolderTimeCache;
	private patch!: FileExplorerPatch;

	async onload(): Promise<void> {
		const plugin = this;
		await this.loadSettings();
		this.folderTimes = new FolderTimeCache(
			this.app.vault.adapter,
			this.settings.folderTimeMode,
		);
		this.patch = new FileExplorerPatch({
			app: this.app,
			get settings(): MixedExplorerSortSettings {
				return plugin.settings;
			},
			folderTimes: this.folderTimes,
			register: (callback: () => void): void => {
				plugin.register(callback);
			},
			registerEvent: (eventRef): void => {
				plugin.registerEvent(eventRef);
			},
		});
		this.folderTimes.setOnFilesystemWarm((): void => {
			this.patch.requestSort();
		});

		this.addSettingTab(new MixedExplorerSortSettingTab(this.app, this));
		this.registerCommands();
		this.registerVaultEvents();
		this.patch.attach();
	}

	onunload(): void {
		this.folderTimes?.clear();
	}

	async loadSettings(): Promise<void> {
		this.settings = parseSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(settingsForSave(this.settings));
		this.folderTimes.setMode(this.settings.folderTimeMode);
		this.folderTimes.clear();
		this.patch.requestSort();
	}

	private registerCommands(): void {
		this.addCommand({
			id: 'toggle-mix-folders-with-files',
			name: 'Toggle mix folders with files',
			callback: (): void => {
				void this.toggleMix();
			},
		});
		this.addCommand({
			id: 'set-folder-time-newest-descendant',
			name: 'Set folder time to newest descendant',
			callback: (): void => {
				void this.setFolderTimeMode('newest-descendant');
			},
		});
		this.addCommand({
			id: 'set-folder-time-newest-direct-child',
			name: 'Set folder time to newest direct child',
			callback: (): void => {
				void this.setFolderTimeMode('newest-direct-child');
			},
		});
		this.addCommand({
			id: 'set-folder-time-filesystem',
			name: 'Set folder time to filesystem',
			callback: (): void => {
				void this.setFolderTimeMode('filesystem');
			},
		});
	}

	private async toggleMix(): Promise<void> {
		this.settings.mixFoldersWithFiles = !this.settings.mixFoldersWithFiles;
		await this.saveSettings();
	}

	private async setFolderTimeMode(mode: FolderTimeMode): Promise<void> {
		if (!isFolderTimeMode(mode)) {
			return;
		}
		this.settings.folderTimeMode = mode;
		await this.saveSettings();
	}

	private registerVaultEvents(): void {
		const onPathChange = (file: TAbstractFile, oldPath?: string): void => {
			this.folderTimes.invalidatePath(file.path);
			if (oldPath !== undefined) {
				this.folderTimes.invalidatePath(oldPath);
			}
			this.patch.requestSort();
		};

		this.registerEvent(
			this.app.vault.on('create', (file: TAbstractFile) => {
				onPathChange(file);
			}),
		);
		this.registerEvent(
			this.app.vault.on('delete', (file: TAbstractFile) => {
				onPathChange(file);
			}),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
				onPathChange(file, oldPath);
			}),
		);
		this.registerEvent(
			this.app.vault.on('modify', (file: TAbstractFile) => {
				this.folderTimes.invalidatePath(file.path);
				const sortOrder = this.patch.currentSortOrder();
				if (
					sortOrder === 'byModifiedTime' ||
					sortOrder === 'byModifiedTimeReverse'
				) {
					this.patch.requestSort();
				}
			}),
		);
	}
}
