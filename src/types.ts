/**
 * Public mix contract. Callers observe order, settings fields, and command ids.
 */

export type FolderTimeMode =
	| 'newest-descendant'
	| 'newest-direct-child'
	| 'filesystem';

export type ExplorerSortOrder =
	| 'alphabetical'
	| 'alphabeticalReverse'
	| 'byModifiedTime'
	| 'byModifiedTimeReverse'
	| 'byCreatedTime'
	| 'byCreatedTimeReverse';

export type TimeKey = 'mtime' | 'ctime';

export interface MixedExplorerSortSettings {
	mixFoldersWithFiles: boolean;
	folderTimeMode: FolderTimeMode;
	mixOnAllSortOrders: boolean;
}

export const DEFAULT_SETTINGS: MixedExplorerSortSettings = {
	mixFoldersWithFiles: true,
	folderTimeMode: 'newest-descendant',
	mixOnAllSortOrders: true,
};

export const EXPLORER_SORT_ORDERS: readonly ExplorerSortOrder[] = [
	'alphabetical',
	'alphabeticalReverse',
	'byModifiedTime',
	'byModifiedTimeReverse',
	'byCreatedTime',
	'byCreatedTimeReverse',
];

export const FOLDER_TIME_MODES: readonly FolderTimeMode[] = [
	'newest-descendant',
	'newest-direct-child',
	'filesystem',
];

export const FILE_EXPLORER_VIEW_TYPE = 'file-explorer';

export const FILE_EXPLORER_READY_SELECTOR =
	'[data-type="file-explorer"] .nav-files-container';

/**
 * Vault entry shape used by the comparator. TFile and TFolder satisfy this.
 */
export interface VaultFile {
	path: string;
	name: string;
	basename: string;
	parent: VaultFolder | null;
	stat: {
		mtime: number;
		ctime: number;
	};
}

export interface VaultFolder {
	path: string;
	name: string;
	parent: VaultFolder | null;
	children: VaultChild[];
}

export type VaultChild = VaultFile | VaultFolder;

export interface ExplorerTreeItem {
	file: VaultChild;
}

export interface FolderStatSnapshot {
	mtime: number;
	ctime: number;
}

export interface FolderStatAdapter {
	stat(normalizedPath: string): Promise<FolderStatSnapshot | null>;
}

export interface FolderTimeLookup {
	getTime(folder: VaultFolder, timeKey: TimeKey): number;
	getFileTime(file: VaultFile, timeKey: TimeKey): number;
}

export function isVaultFolder(entry: VaultChild): entry is VaultFolder {
	return Array.isArray((entry as VaultFolder).children);
}

export function isExplorerSortOrder(value: string): value is ExplorerSortOrder {
	return (EXPLORER_SORT_ORDERS as readonly string[]).includes(value);
}

export function isFolderTimeMode(value: string): value is FolderTimeMode {
	return (FOLDER_TIME_MODES as readonly string[]).includes(value);
}

export function timeKeyForSortOrder(sortOrder: ExplorerSortOrder): TimeKey | null {
	if (sortOrder === 'byModifiedTime' || sortOrder === 'byModifiedTimeReverse') {
		return 'mtime';
	}
	if (sortOrder === 'byCreatedTime' || sortOrder === 'byCreatedTimeReverse') {
		return 'ctime';
	}
	return null;
}

/**
 * Mix applies to modified-time always (when mix is on). Name and created
 * mix only when mixOnAllSortOrders is true.
 */
export function shouldApplyMix(
	settings: MixedExplorerSortSettings,
	sortOrder: string,
): boolean {
	if (!settings.mixFoldersWithFiles) {
		return false;
	}
	if (!isExplorerSortOrder(sortOrder)) {
		return false;
	}
	if (settings.mixOnAllSortOrders) {
		return true;
	}
	return sortOrder === 'byModifiedTime' || sortOrder === 'byModifiedTimeReverse';
}
