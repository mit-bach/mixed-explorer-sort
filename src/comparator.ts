import {
	isExplorerSortOrder,
	isVaultFolder,
	shouldApplyMix,
	timeKeyForSortOrder,
	type ExplorerSortOrder,
	type ExplorerTreeItem,
	type FolderTimeLookup,
	type MixedExplorerSortSettings,
	type TimeKey,
	type VaultChild,
} from './types';

const NAME_COMPARE_OPTIONS: Intl.CollatorOptions = {
	numeric: true,
	sensitivity: 'base',
};

export function compareNames(a: string, b: string): number {
	return a.localeCompare(b, undefined, NAME_COMPARE_OPTIONS);
}

/**
 * Native Files compares files by basename and folders by name.
 * Mix uses the same labels so A-to-Z matches the Files sort menu.
 */
export function sortLabel(entry: VaultChild): string {
	if (isVaultFolder(entry)) {
		return entry.name;
	}
	return entry.basename;
}

function timeOf(
	entry: VaultChild,
	timeKey: TimeKey,
	folderTime: FolderTimeLookup,
): number {
	if (isVaultFolder(entry)) {
		return folderTime.getTime(entry, timeKey);
	}
	return timeKey === 'mtime' ? entry.stat.mtime : entry.stat.ctime;
}

/**
 * One mixed comparator. No folders-first branch.
 *
 * Native Files menu (Custom Sort internals evidence):
 * byModifiedTime / byCreatedTime = new → old = time(b) - time(a).
 * Reverse keys = old → new.
 */
export function compareMixed(
	a: VaultChild,
	b: VaultChild,
	sortOrder: ExplorerSortOrder,
	folderTime: FolderTimeLookup,
): number {
	if (sortOrder === 'alphabetical') {
		return compareNames(sortLabel(a), sortLabel(b));
	}
	if (sortOrder === 'alphabeticalReverse') {
		return compareNames(sortLabel(b), sortLabel(a));
	}

	const timeKey = timeKeyForSortOrder(sortOrder);
	if (timeKey === null) {
		return compareNames(sortLabel(a), sortLabel(b));
	}

	const aTime = timeOf(a, timeKey, folderTime);
	const bTime = timeOf(b, timeKey, folderTime);
	const newestFirst =
		sortOrder === 'byModifiedTime' || sortOrder === 'byCreatedTime';
	const delta = newestFirst ? bTime - aTime : aTime - bTime;
	if (delta !== 0) {
		return delta;
	}
	return compareNames(sortLabel(a), sortLabel(b));
}

export function sortTreeItems<T extends ExplorerTreeItem>(
	items: readonly T[],
	sortOrder: ExplorerSortOrder,
	folderTime: FolderTimeLookup,
): T[] {
	return items.slice().sort((left: T, right: T): number => {
		return compareMixed(left.file, right.file, sortOrder, folderTime);
	});
}

/**
 * File Explorer wrapper body. Mix-off returns the original `old()` array.
 * Mix-on re-sorts a copy. No folders-first branch.
 */
export function wrapGetSortedFolderItems<T extends ExplorerTreeItem>(
	original: T[],
	sortOrder: string,
	settings: MixedExplorerSortSettings,
	folderTime: FolderTimeLookup,
): T[] {
	if (!shouldApplyMix(settings, sortOrder) || !isExplorerSortOrder(sortOrder)) {
		return original;
	}
	return sortTreeItems(original, sortOrder, folderTime);
}
