import {
	isVaultFolder,
	type FolderStatAdapter,
	type FolderStatSnapshot,
	type FolderTimeLookup,
	type FolderTimeMode,
	type TimeKey,
	type VaultChild,
	type VaultFolder,
} from './types';

export const EMPTY_FOLDER_TIME = 0;

interface MemoKey {
	path: string;
	mode: FolderTimeMode;
	timeKey: TimeKey;
}

function memoId(key: MemoKey): string {
	return `${key.path}\0${key.mode}\0${key.timeKey}`;
}

function ancestorPaths(path: string): string[] {
	if (path === '' || path === '/') {
		return [''];
	}
	const parts = path.split('/').filter((part: string) => part.length > 0);
	const paths: string[] = [path];
	while (parts.length > 0) {
		parts.pop();
		paths.push(parts.join('/'));
	}
	return paths;
}

export class FolderTimeCache implements FolderTimeLookup {
	private readonly computed = new Map<string, number>();
	private readonly filesystem = new Map<string, FolderStatSnapshot | null>();
	private readonly inflight = new Set<string>();
	private statFailureRecorded = false;
	private mode: FolderTimeMode;
	private onFilesystemWarm: (() => void) | null = null;

	constructor(
		private readonly adapter: FolderStatAdapter | null,
		mode: FolderTimeMode,
	) {
		this.mode = mode;
	}

	setMode(mode: FolderTimeMode): void {
		if (this.mode === mode) {
			return;
		}
		this.mode = mode;
		this.computed.clear();
	}

	setOnFilesystemWarm(callback: (() => void) | null): void {
		this.onFilesystemWarm = callback;
	}

	clear(): void {
		this.computed.clear();
		this.filesystem.clear();
		this.inflight.clear();
	}

	invalidatePath(path: string): void {
		const prefixes = ancestorPaths(path);
		for (const cachedKey of [...this.computed.keys()]) {
			const cachedPath = cachedKey.split('\0')[0] ?? '';
			if (prefixes.includes(cachedPath) || cachedPath === path) {
				this.computed.delete(cachedKey);
			}
		}
		for (const folderPath of prefixes) {
			this.filesystem.delete(folderPath);
		}
	}

	cacheFilesystemStat(path: string, stat: FolderStatSnapshot | null): void {
		this.filesystem.set(path, stat);
		this.computed.clear();
	}

	getTime(folder: VaultFolder, timeKey: TimeKey): number {
		const key: MemoKey = {
			path: folder.path,
			mode: this.mode,
			timeKey,
		};
		const existing = this.computed.get(memoId(key));
		if (existing !== undefined) {
			return existing;
		}
		const value = this.compute(folder, timeKey, new Set<string>());
		this.computed.set(memoId(key), value);
		return value;
	}

	private compute(
		folder: VaultFolder,
		timeKey: TimeKey,
		stack: Set<string>,
	): number {
		if (stack.has(folder.path)) {
			return EMPTY_FOLDER_TIME;
		}
		if (this.mode === 'filesystem') {
			return this.filesystemTime(folder, timeKey);
		}
		stack.add(folder.path);
		let best = EMPTY_FOLDER_TIME;
		for (const child of folder.children) {
			const childTime = this.childTime(child, timeKey, stack);
			if (childTime > best) {
				best = childTime;
			}
		}
		stack.delete(folder.path);
		return best;
	}

	private childTime(
		child: VaultChild,
		timeKey: TimeKey,
		stack: Set<string>,
	): number {
		if (!isVaultFolder(child)) {
			return timeKey === 'mtime' ? child.stat.mtime : child.stat.ctime;
		}
		if (this.mode === 'newest-direct-child') {
			return EMPTY_FOLDER_TIME;
		}
		const nestedKey = memoId({
			path: child.path,
			mode: this.mode,
			timeKey,
		});
		const cached = this.computed.get(nestedKey);
		if (cached !== undefined) {
			return cached;
		}
		const nested = this.compute(child, timeKey, stack);
		this.computed.set(nestedKey, nested);
		return nested;
	}

	private filesystemTime(folder: VaultFolder, timeKey: TimeKey): number {
		const cached = this.filesystem.get(folder.path);
		if (cached === undefined) {
			this.scheduleStat(folder.path);
			return EMPTY_FOLDER_TIME;
		}
		if (cached === null) {
			return EMPTY_FOLDER_TIME;
		}
		return timeKey === 'mtime' ? cached.mtime : cached.ctime;
	}

	private scheduleStat(path: string): void {
		if (this.adapter === null || this.inflight.has(path)) {
			return;
		}
		this.inflight.add(path);
		void this.adapter
			.stat(path)
			.then((stat: FolderStatSnapshot | null): void => {
				this.inflight.delete(path);
				this.filesystem.set(path, stat);
				this.computed.clear();
				this.onFilesystemWarm?.();
			})
			.catch((): void => {
				this.inflight.delete(path);
				this.filesystem.set(path, null);
				this.computed.clear();
				if (!this.statFailureRecorded) {
					this.statFailureRecorded = true;
					console.warn(
						'mixed-explorer-sort: vault.adapter.stat failed; folder time is 0',
					);
				}
			});
	}
}
