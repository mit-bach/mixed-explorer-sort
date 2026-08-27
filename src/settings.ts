import {
	DEFAULT_SETTINGS,
	isFolderTimeMode,
	type MixedExplorerSortSettings,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/**
 * Validate plugin data.json at the load boundary. Never throws.
 * Extra keys are dropped. Invalid enums become defaults.
 */
export function parseSettings(raw: unknown): MixedExplorerSortSettings {
	if (!isRecord(raw)) {
		return { ...DEFAULT_SETTINGS };
	}
	const folderTimeMode = isFolderTimeMode(String(raw['folderTimeMode'] ?? ''))
		? (raw['folderTimeMode'] as MixedExplorerSortSettings['folderTimeMode'])
		: DEFAULT_SETTINGS.folderTimeMode;
	return {
		mixFoldersWithFiles: readBoolean(
			raw['mixFoldersWithFiles'],
			DEFAULT_SETTINGS.mixFoldersWithFiles,
		),
		folderTimeMode,
		mixOnAllSortOrders: readBoolean(
			raw['mixOnAllSortOrders'],
			DEFAULT_SETTINGS.mixOnAllSortOrders,
		),
	};
}

export function settingsForSave(
	settings: MixedExplorerSortSettings,
): MixedExplorerSortSettings {
	return {
		mixFoldersWithFiles: settings.mixFoldersWithFiles,
		folderTimeMode: settings.folderTimeMode,
		mixOnAllSortOrders: settings.mixOnAllSortOrders,
	};
}

export { DEFAULT_SETTINGS };
