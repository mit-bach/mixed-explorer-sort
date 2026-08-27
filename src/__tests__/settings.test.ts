import { describe, expect, it } from 'vitest';

import { parseSettings } from '../settings';
import { DEFAULT_SETTINGS, shouldApplyMix } from '../types';

describe('parseSettings', () => {
	it('returns defaults for missing or non-object data', () => {
		expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
	});

	it('coerces invalid enums and booleans to defaults', () => {
		expect(
			parseSettings({
				mixFoldersWithFiles: 'yes',
				folderTimeMode: 'magic',
				mixOnAllSortOrders: 1,
			}),
		).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps valid fields and drops extras', () => {
		const parsed = parseSettings({
			mixFoldersWithFiles: false,
			folderTimeMode: 'filesystem',
			mixOnAllSortOrders: false,
			extra: true,
		});
		expect(parsed).toEqual({
			mixFoldersWithFiles: false,
			folderTimeMode: 'filesystem',
			mixOnAllSortOrders: false,
		});
		expect(parsed).not.toHaveProperty('extra');
	});
});

describe('shouldApplyMix', () => {
	it('is off when mixFoldersWithFiles is false', () => {
		expect(
			shouldApplyMix(
				{ ...DEFAULT_SETTINGS, mixFoldersWithFiles: false },
				'byModifiedTime',
			),
		).toBe(false);
	});

	it('mixes only modified time when mixOnAllSortOrders is false', () => {
		const settings = { ...DEFAULT_SETTINGS, mixOnAllSortOrders: false };
		expect(shouldApplyMix(settings, 'byModifiedTime')).toBe(true);
		expect(shouldApplyMix(settings, 'byModifiedTimeReverse')).toBe(true);
		expect(shouldApplyMix(settings, 'alphabetical')).toBe(false);
		expect(shouldApplyMix(settings, 'byCreatedTime')).toBe(false);
	});
});
