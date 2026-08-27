import type { VaultChild, VaultFile, VaultFolder } from '../types';

export function makeFile(
	name: string,
	mtime: number,
	ctime: number = mtime,
	parent: VaultFolder | null = null,
): VaultFile {
	const path = parent === null || parent.path === '' ? name : `${parent.path}/${name}`;
	const lastDot = name.lastIndexOf('.');
	const basename = lastDot > 0 ? name.slice(0, lastDot) : name;
	return {
		path,
		name,
		basename,
		parent,
		stat: { mtime, ctime },
	};
}

export function makeFolder(
	name: string,
	children: VaultChild[] = [],
	parent: VaultFolder | null = null,
): VaultFolder {
	const path =
		name === ''
			? ''
			: parent === null || parent.path === ''
				? name
				: `${parent.path}/${name}`;
	const folder: VaultFolder = {
		path,
		name,
		parent,
		children: [],
	};
	folder.children = children.map((child: VaultChild): VaultChild => {
		child.parent = folder;
		if ('stat' in child) {
			return {
				...child,
				path: path === '' ? child.name : `${path}/${child.name}`,
				parent: folder,
			};
		}
		const nested = makeFolder(child.name, child.children, folder);
		return nested;
	});
	return folder;
}

export function itemOf(file: VaultChild): { file: VaultChild } {
	return { file };
}

export function namesOf(items: readonly { file: VaultChild }[]): string[] {
	return items.map((item: { file: VaultChild }) => item.file.name);
}

/**
 * True when every folder appears before every file.
 * A mixed interleave must make this false.
 */
export function isFoldersFirst(items: readonly { file: VaultChild }[]): boolean {
	let seenFile = false;
	for (const item of items) {
		const folder = Array.isArray((item.file as VaultFolder).children);
		if (folder) {
			if (seenFile) {
				return false;
			}
		} else {
			seenFile = true;
		}
	}
	return true;
}
