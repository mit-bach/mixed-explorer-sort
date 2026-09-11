import { describe, expect, it } from 'vitest';

import { wrapGetSortedFolderItems } from '../comparator';
import { FolderTimeCache } from '../folder-time';
import { DEFAULT_SETTINGS, type ExplorerTreeItem } from '../types';
import { isFoldersFirst, itemOf, makeFile, makeFolder, namesOf } from './helpers';

/**
 * Fake original getSortedFolderItems: native Files folders-first.
 */
function fakeOld(items: ExplorerTreeItem[]): () => ExplorerTreeItem[] {
	return (): ExplorerTreeItem[] => items;
}

describe('File Explorer wrapper', () => {
	it('mix-on must not return folders-first from fake old()', () => {
		const archive = makeFolder('Archive', [makeFile('old.md', 10)]);
		const today = makeFile('Today.md', 999);
		const foldersFirst = [itemOf(archive), itemOf(today)];
		const old = fakeOld(foldersFirst);
		const original = old();
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const mixed = wrapGetSortedFolderItems(
			original,
			'byModifiedTime',
			{ ...DEFAULT_SETTINGS, mixFoldersWithFiles: true },
			folderTime,
		);

		expect(isFoldersFirst(original)).toBe(true);
		expect(namesOf(mixed)).toEqual(['Today.md', 'Archive']);
		expect(isFoldersFirst(mixed)).toBe(false);
		expect(mixed).not.toBe(original);
	});

	it('mix-off time sort keeps folders first and reorders files by seconds', () => {
		const minute = 1_700_000_000_000;
		const archive = makeFolder('Archive', [makeFile('old.md', 10)]);
		const early = makeFile('early.md', minute + 2_000);
		const late = makeFile('late.md', minute + 40_000);
		const original = [itemOf(archive), itemOf(early), itemOf(late)];
		const old = fakeOld(original);
		const fromOld = old();
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const mixOff = wrapGetSortedFolderItems(
			fromOld,
			'byModifiedTime',
			{ ...DEFAULT_SETTINGS, mixFoldersWithFiles: false },
			folderTime,
		);

		expect(isFoldersFirst(mixOff)).toBe(true);
		expect(namesOf(mixOff)).toEqual(['Archive', 'late.md', 'early.md']);
	});
});
