import { describe, expect, it } from 'vitest';

import { compareMixed, wrapGetSortedFolderItems } from '../comparator';
import { EMPTY_FOLDER_TIME, FolderTimeCache } from '../folder-time';
import { DEFAULT_SETTINGS } from '../types';
import { isFoldersFirst, itemOf, makeFile, makeFolder, namesOf } from './helpers';

describe('FolderTimeCache', () => {
	it('lifts a parent folder when a nested child is newer in descendant mode', () => {
		const nestedNote = makeFile('child.md', 900);
		const nested = makeFolder('Nested', [nestedNote]);
		const sibling = makeFile('sibling.md', 100);
		const parent = makeFolder('Parent', [nested, sibling]);
		const middle = makeFile('Middle.md', 500);
		const oldFolder = makeFolder('OldFolder', [makeFile('stale.md', 50)]);
		const cache = new FolderTimeCache(null, 'newest-descendant');

		expect(cache.getTime(parent, 'mtime')).toBe(900);
		expect(cache.getTime(nested, 'mtime')).toBe(900);
		expect(compareMixed(parent, middle, 'byModifiedTime', cache)).toBeLessThan(0);

		const foldersFirst = [itemOf(parent), itemOf(oldFolder), itemOf(middle)];
		const mixed = wrapGetSortedFolderItems(
			foldersFirst,
			'byModifiedTime',
			{ ...DEFAULT_SETTINGS, mixFoldersWithFiles: true },
			cache,
		);
		expect(namesOf(mixed)).toEqual(['Parent', 'Middle.md', 'OldFolder']);
		expect(namesOf(mixed)).not.toEqual(['Parent', 'OldFolder', 'Middle.md']);
		expect(isFoldersFirst(mixed)).toBe(false);
		expect(isFoldersFirst(foldersFirst)).toBe(true);
	});

	it('does not lift a parent from a nested-only child in direct-child mode', () => {
		const nestedNote = makeFile('child.md', 900);
		const nested = makeFolder('Nested', [nestedNote]);
		const sibling = makeFile('sibling.md', 100);
		const parent = makeFolder('Parent', [nested, sibling]);
		const cache = new FolderTimeCache(null, 'newest-direct-child');

		expect(cache.getTime(parent, 'mtime')).toBe(100);
		expect(cache.getTime(nested, 'mtime')).toBe(900);
	});

	it('returns 0 for empty folders and nested-only folders in direct-child mode', () => {
		const empty = makeFolder('Empty', []);
		const nestedOnly = makeFolder('NestedOnly', [makeFolder('Inside', [])]);
		const cache = new FolderTimeCache(null, 'newest-direct-child');
		expect(cache.getTime(empty, 'mtime')).toBe(EMPTY_FOLDER_TIME);
		expect(cache.getTime(nestedOnly, 'mtime')).toBe(EMPTY_FOLDER_TIME);
	});

	it('uses cached filesystem inode time and ignores a newer child', () => {
		const child = makeFile('child.md', 900);
		const parent = makeFolder('Parent', [child]);
		const cache = new FolderTimeCache(null, 'filesystem');
		cache.cacheFilesystemStat(parent.path, { mtime: 50, ctime: 40 });
		expect(cache.getTime(parent, 'mtime')).toBe(50);
		expect(cache.getTime(parent, 'ctime')).toBe(40);
	});

	it('returns 0 for a cold filesystem cache without awaiting', () => {
		const parent = makeFolder('Parent', [makeFile('child.md', 900)]);
		const cache = new FolderTimeCache(null, 'filesystem');
		expect(cache.getTime(parent, 'mtime')).toBe(EMPTY_FOLDER_TIME);
	});

	it('warms filesystem cache from adapter.stat after getTime returns', async () => {
		const parent = makeFolder('Parent', [makeFile('child.md', 900)]);
		const cache = new FolderTimeCache(
			{
				stat: (): Promise<{ mtime: number; ctime: number }> => {
					return Promise.resolve({ mtime: 123, ctime: 45 });
				},
			},
			'filesystem',
		);
		let warmed = false;
		cache.setOnFilesystemWarm((): void => {
			warmed = true;
		});
		expect(cache.getTime(parent, 'mtime')).toBe(EMPTY_FOLDER_TIME);
		await Promise.resolve();
		expect(warmed).toBe(true);
		expect(cache.getTime(parent, 'mtime')).toBe(123);
		expect(cache.getTime(parent, 'ctime')).toBe(45);
	});

	it('invalidates a parent when a child path changes', () => {
		const child = makeFile('child.md', 100);
		const parent = makeFolder('Parent', [child]);
		const cache = new FolderTimeCache(null, 'newest-descendant');
		expect(cache.getTime(parent, 'mtime')).toBe(100);
		parent.children = [makeFile('child.md', 800, 800, parent)];
		cache.invalidatePath(parent.children[0]?.path ?? 'Parent/child.md');
		expect(cache.getTime(parent, 'mtime')).toBe(800);
	});
});
