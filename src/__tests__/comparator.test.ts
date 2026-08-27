import { describe, expect, it } from 'vitest';

import { compareMixed, wrapGetSortedFolderItems } from '../comparator';
import { FolderTimeCache } from '../folder-time';
import { DEFAULT_SETTINGS, type MixedExplorerSortSettings } from '../types';
import { isFoldersFirst, itemOf, makeFile, makeFolder, namesOf } from './helpers';

function mixOn(
	overrides: Partial<MixedExplorerSortSettings> = {},
): MixedExplorerSortSettings {
	return { ...DEFAULT_SETTINGS, mixFoldersWithFiles: true, ...overrides };
}

describe('compareMixed', () => {
	it('interleaves a file between two folders by modified time new to old', () => {
		const newer = makeFolder('Newer', [makeFile('new.md', 300)]);
		const older = makeFolder('Older', [makeFile('old.md', 100)]);
		const middle = makeFile('Middle.md', 200);
		const parent = makeFolder('', [newer, older, middle]);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const original = [itemOf(newer), itemOf(older), itemOf(middle)];
		const mixed = wrapGetSortedFolderItems(
			original,
			'byModifiedTime',
			mixOn(),
			folderTime,
		);

		expect(namesOf(mixed)).toEqual(['Newer', 'Middle.md', 'Older']);
		expect(isFoldersFirst(mixed)).toBe(false);
		expect(namesOf(original)).toEqual(['Newer', 'Older', 'Middle.md']);
		expect(isFoldersFirst(original)).toBe(true);
		expect(parent.children).toHaveLength(3);
	});

	it('fails the mix claim if folders-first is restored', () => {
		const folder = makeFolder('Archive', [makeFile('old.md', 10)]);
		const recent = makeFile('Today.md', 999);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const mixed = wrapGetSortedFolderItems(
			[itemOf(folder), itemOf(recent)],
			'byModifiedTime',
			mixOn(),
			folderTime,
		);
		const foldersFirst = [itemOf(folder), itemOf(recent)];

		expect(namesOf(mixed)).toEqual(['Today.md', 'Archive']);
		expect(namesOf(mixed)).not.toEqual(namesOf(foldersFirst));
		expect(isFoldersFirst(mixed)).toBe(false);
	});

	it('sorts modified old to new without grouping folders', () => {
		const newer = makeFolder('Newer', [makeFile('new.md', 300)]);
		const older = makeFolder('Older', [makeFile('old.md', 100)]);
		const middle = makeFile('Middle.md', 200);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const mixed = wrapGetSortedFolderItems(
			[itemOf(newer), itemOf(older), itemOf(middle)],
			'byModifiedTimeReverse',
			mixOn(),
			folderTime,
		);
		expect(namesOf(mixed)).toEqual(['Older', 'Middle.md', 'Newer']);
		expect(isFoldersFirst(mixed)).toBe(false);
	});

	it('mixes names when mixOnAllSortOrders is true', () => {
		const folder = makeFolder('Zebra', []);
		const file = makeFile('apple.md', 1);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const mixed = wrapGetSortedFolderItems(
			[itemOf(folder), itemOf(file)],
			'alphabetical',
			mixOn({ mixOnAllSortOrders: true }),
			folderTime,
		);
		expect(namesOf(mixed)).toEqual(['apple.md', 'Zebra']);
		expect(isFoldersFirst(mixed)).toBe(false);
	});

	it('does not mix names when mixOnAllSortOrders is false', () => {
		const folder = makeFolder('Zebra', []);
		const file = makeFile('apple.md', 1);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const original = [itemOf(folder), itemOf(file)];
		const mixed = wrapGetSortedFolderItems(
			original,
			'alphabetical',
			mixOn({ mixOnAllSortOrders: false }),
			folderTime,
		);
		expect(mixed).toBe(original);
		expect(namesOf(mixed)).toEqual(['Zebra', 'apple.md']);
		expect(isFoldersFirst(mixed)).toBe(true);
	});

	it('returns the original old() array when mix is off', () => {
		const folder = makeFolder('Archive', [makeFile('old.md', 10)]);
		const recent = makeFile('Today.md', 999);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const original = [itemOf(folder), itemOf(recent)];
		const mixed = wrapGetSortedFolderItems(
			original,
			'byModifiedTime',
			{ ...DEFAULT_SETTINGS, mixFoldersWithFiles: false },
			folderTime,
		);
		expect(mixed).toBe(original);
		expect(namesOf(mixed)).toEqual(['Archive', 'Today.md']);
		expect(isFoldersFirst(mixed)).toBe(true);
	});

	it('breaks time ties with numeric-base name compare', () => {
		const a = makeFile('file2.md', 50);
		const b = makeFile('file10.md', 50);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		expect(compareMixed(a, b, 'byModifiedTime', folderTime)).toBeLessThan(0);
	});

	it('interleaves a file between two folders by created time new to old', () => {
		const newer = makeFolder('Newer', [
			makeFile('new.md', 10, 300),
		]);
		const older = makeFolder('Older', [
			makeFile('old.md', 10, 100),
		]);
		const middle = makeFile('Middle.md', 999, 200);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const original = [itemOf(newer), itemOf(older), itemOf(middle)];
		const mixed = wrapGetSortedFolderItems(
			original,
			'byCreatedTime',
			mixOn(),
			folderTime,
		);
		expect(namesOf(mixed)).toEqual(['Newer', 'Middle.md', 'Older']);
		expect(isFoldersFirst(mixed)).toBe(false);
		expect(isFoldersFirst(original)).toBe(true);
	});

	it('compares files by basename, not name with extension', () => {
		const folder = makeFolder('Report', []);
		const file = makeFile('Report.md', 1);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		expect(compareMixed(folder, file, 'alphabetical', folderTime)).toBe(0);
		expect(file.basename).toBe('Report');
		expect(file.name).toBe('Report.md');
	});

	it('mixes alphabeticalReverse without grouping folders', () => {
		const folder = makeFolder('Alpha', []);
		const file = makeFile('zebra.md', 1);
		const folderTime = new FolderTimeCache(null, 'newest-descendant');
		const mixed = wrapGetSortedFolderItems(
			[itemOf(folder), itemOf(file)],
			'alphabeticalReverse',
			mixOn(),
			folderTime,
		);
		expect(namesOf(mixed)).toEqual(['zebra.md', 'Alpha']);
		expect(isFoldersFirst(mixed)).toBe(false);
	});
});
