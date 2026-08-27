import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';

import type MixedExplorerSortPlugin from './main';
import type { FolderTimeMode } from './types';

const FOLDER_TIME_OPTIONS: Record<FolderTimeMode, string> = {
	'newest-descendant': 'Newest descendant',
	'newest-direct-child': 'Newest direct child',
	filesystem: 'Filesystem',
};

export class MixedExplorerSortSettingTab extends PluginSettingTab {
	plugin: MixedExplorerSortPlugin;

	constructor(app: App, plugin: MixedExplorerSortPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Mix folders with files')
			.setDesc(
				'Treat folders like files under one sort. Off restores core folders-first order.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.mixFoldersWithFiles)
					.onChange(async (value: boolean) => {
						this.plugin.settings.mixFoldersWithFiles = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Folder time')
			.setDesc(
				'How a folder gets a modified or created time. Filesystem uses the directory inode and does not move when a note inside is edited.',
			)
			.addDropdown((dropdown) => {
				dropdown.addOptions(FOLDER_TIME_OPTIONS);
				dropdown.setValue(this.plugin.settings.folderTimeMode);
				dropdown.onChange(async (value: string) => {
					if (
						value === 'newest-descendant' ||
						value === 'newest-direct-child' ||
						value === 'filesystem'
					) {
						this.plugin.settings.folderTimeMode = value;
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Mix on all sort orders')
			.setDesc(
				'When off, mix only for modified time. Name and created stay core folders-first.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.mixOnAllSortOrders)
					.onChange(async (value: boolean) => {
						this.plugin.settings.mixOnAllSortOrders = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
