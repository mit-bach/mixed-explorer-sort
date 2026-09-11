/**
 * Disk timestamps for File Explorer sort.
 *
 * Obsidian FileStats.mtime / ctime are milliseconds
 * (https://docs.obsidian.md/Reference/TypeScript+API/FileStats).
 * Desktop Node fs.statSync exposes mtimeMs and birthtimeMs
 * (https://nodejs.org/docs/latest-v22.x/api/fs.html#class-fsstats).
 * birthtimeMs is file creation on macOS and Windows. Linux often reports 0.
 */

export interface DiskTimes {
	mtime: number;
	created: number;
}

export type AbsolutePathResolver = (normalizedPath: string) => string;

interface NodeStatLike {
	mtimeMs: number;
	ctimeMs: number;
	birthtimeMs: number;
}

interface NodeFsLike {
	statSync: (absolutePath: string) => NodeStatLike;
}

const UNIX_SECONDS_FLOOR = 1e9;
const UNIX_SECONDS_CEIL = 1e11;

/**
 * Adapter Stat omits units. FileStats is milliseconds. Values in
 * [1e9, 1e11) are treated as unix seconds (2001 through year 5138).
 */
export function asMillis(value: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		return 0;
	}
	if (value >= UNIX_SECONDS_FLOOR && value < UNIX_SECONDS_CEIL) {
		return value * 1000;
	}
	return value;
}

export function createdFromDisk(mtime: number, ctime: number, birth: number): number {
	const birthMs = asMillis(birth);
	if (birthMs > 0) {
		return birthMs;
	}
	const created = asMillis(ctime);
	if (created > 0) {
		return created;
	}
	return asMillis(mtime);
}

function nodeFs(): NodeFsLike | null {
	try {
		const req = (globalThis as { require?: (id: string) => unknown }).require;
		if (typeof req !== 'function') {
			return null;
		}
		const loaded = req('fs');
		if (typeof loaded !== 'object' || loaded === null) {
			return null;
		}
		const statSync = (loaded as NodeFsLike).statSync;
		if (typeof statSync !== 'function') {
			return null;
		}
		return { statSync };
	} catch {
		return null;
	}
}

export function tryReadDiskTimes(absolutePath: string): DiskTimes | null {
	const fsMod = nodeFs();
	if (fsMod === null) {
		return null;
	}
	try {
		const st = fsMod.statSync(absolutePath);
		const mtime = asMillis(st.mtimeMs);
		return {
			mtime,
			created: createdFromDisk(mtime, st.ctimeMs, st.birthtimeMs),
		};
	} catch {
		return null;
	}
}

/**
 * Path-keyed disk times. Seed in tests. Read through a resolver on desktop.
 */
export class DiskTimeCache {
	private readonly byPath = new Map<string, DiskTimes | null>();

	constructor(private readonly resolveAbsolute: AbsolutePathResolver | null) {}

	seed(path: string, times: DiskTimes): void {
		this.byPath.set(path, times);
	}

	read(path: string): DiskTimes | null {
		const cached = this.byPath.get(path);
		if (cached !== undefined) {
			return cached;
		}
		if (this.resolveAbsolute === null) {
			return null;
		}
		let absolute: string;
		try {
			absolute = this.resolveAbsolute(path);
		} catch {
			this.byPath.set(path, null);
			return null;
		}
		const times = tryReadDiskTimes(absolute);
		this.byPath.set(path, times);
		return times;
	}

	invalidate(path: string): void {
		this.byPath.delete(path);
	}

	clear(): void {
		this.byPath.clear();
	}
}
