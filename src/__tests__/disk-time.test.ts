import { describe, expect, it } from 'vitest';

import { wrapGetSortedFolderItems } from '../comparator';
import { asMillis, DiskTimeCache } from '../disk-time';
import { FolderTimeCache } from '../folder-time';
import { DEFAULT_SETTINGS } from '../types';
import { itemOf, makeFile, namesOf } from './helpers';

describe('asMillis', () => {
	it('leaves millisecond unix times and small test clocks unchanged', () => {
		expect(asMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
		expect(asMillis(900)).toBe(900);
		expect(asMillis(0)).toBe(0);
	});

	it('promotes unix seconds to milliseconds', () => {
		expect(asMillis(1_700_000_000)).toBe(1_700_000_000_000);
	});
});

describe('DiskTimeCache', () => {
	it('overrides floored FileStats so same-minute files sort by seconds', () => {
		const minute = 1_700_000_040_000;
		const early = makeFile('early.md', minute);
		const late = makeFile('late.md', minute);
		const disk = new DiskTimeCache(null);
		disk.seed(early.path, { mtime: minute + 1_000, created: minute + 1_000 });
		disk.seed(late.path, { mtime: minute + 22_000, created: minute + 22_000 });
		const folderTime = new FolderTimeCache(null, 'newest-descendant', disk);
		const mixed = wrapGetSortedFolderItems(
			[itemOf(early), itemOf(late)],
			'byModifiedTime',
			{ ...DEFAULT_SETTINGS, mixFoldersWithFiles: true },
			folderTime,
		);
		expect(namesOf(mixed)).toEqual(['late.md', 'early.md']);
		expect(folderTime.getFileTime(early, 'mtime')).toBe(minute + 1_000);
		expect(folderTime.getFileTime(late, 'mtime')).toBe(minute + 22_000);
	});

	it('uses seeded created times for created-time sort', () => {
		const minute = 1_700_000_040_000;
		const first = makeFile('first.md', minute, minute);
		const second = makeFile('second.md', minute, minute);
		const disk = new DiskTimeCache(null);
		disk.seed(first.path, { mtime: minute, created: minute + 500 });
		disk.seed(second.path, { mtime: minute, created: minute + 8_000 });
		const folderTime = new FolderTimeCache(null, 'newest-descendant', disk);
		const mixed = wrapGetSortedFolderItems(
			[itemOf(first), itemOf(second)],
			'byCreatedTime',
			{ ...DEFAULT_SETTINGS, mixFoldersWithFiles: true },
			folderTime,
		);
		expect(namesOf(mixed)).toEqual(['second.md', 'first.md']);
	});
});
