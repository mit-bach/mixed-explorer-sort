import { around } from 'monkey-around';
import type { App, EventRef, TFolder, WorkspaceLeaf } from 'obsidian';

import { wrapGetSortedFolderItems } from './comparator';
import type { FolderTimeCache } from './folder-time';
import {
	FILE_EXPLORER_READY_SELECTOR,
	FILE_EXPLORER_VIEW_TYPE,
	isExplorerSortOrder,
	type ExplorerSortOrder,
	type ExplorerTreeItem,
	type MixedExplorerSortSettings,
} from './types';

type MonkeyUninstaller = () => void;

interface PatchableFileExplorerView {
	sortOrder: string;
	getSortedFolderItems: (folder: TFolder) => ExplorerTreeItem[];
	requestSort: () => void;
	constructor: {
		prototype: PatchableFileExplorerView;
	};
}

export interface FileExplorerPatchHost {
	app: App;
	settings: MixedExplorerSortSettings;
	folderTimes: FolderTimeCache;
	register(callback: () => void): void;
	registerEvent(eventRef: EventRef): void;
}

function isPatchableView(view: unknown): view is PatchableFileExplorerView {
	if (typeof view !== 'object' || view === null) {
		return false;
	}
	const candidate = view as Partial<PatchableFileExplorerView>;
	return (
		typeof candidate.getSortedFolderItems === 'function' &&
		typeof candidate.requestSort === 'function'
	);
}

function leafIsDeferred(leaf: WorkspaceLeaf): boolean {
	return leaf.isDeferred === true;
}

export class FileExplorerPatch {
	private uninstaller: MonkeyUninstaller | null = null;
	private patchedPrototype: PatchableFileExplorerView | null = null;
	private observer: MutationObserver | null = null;
	private cancelled = false;

	constructor(private readonly host: FileExplorerPatchHost) {}

	attach(): void {
		this.cancelled = false;
		this.host.registerEvent(
			this.host.app.workspace.on('layout-change', (): void => {
				this.tryAttach();
			}),
		);
		// Workspace.onLayoutReady has no uninstaller (obsidian 1.13.1 d.ts).
		this.host.app.workspace.onLayoutReady((): void => {
			this.tryAttach();
		});
		this.host.register((): void => {
			this.detach();
		});
		this.tryAttach();
	}

	tryAttach(): void {
		if (this.cancelled) {
			return;
		}
		const leaf = this.findExplorerLeaf();
		if (leaf === null) {
			return;
		}
		if (leafIsDeferred(leaf)) {
			this.watchDeferred(leaf);
			return;
		}
		if (!isPatchableView(leaf.view)) {
			return;
		}
		const installed = this.patchView(leaf.view);
		this.stopWatching();
		if (installed) {
			leaf.view.requestSort();
		}
	}

	requestSort(): void {
		const leaf = this.findExplorerLeaf();
		if (leaf === null || leafIsDeferred(leaf) || !isPatchableView(leaf.view)) {
			return;
		}
		leaf.view.requestSort();
	}

	currentSortOrder(): ExplorerSortOrder | null {
		const leaf = this.findExplorerLeaf();
		if (leaf === null || leafIsDeferred(leaf) || !isPatchableView(leaf.view)) {
			return null;
		}
		return isExplorerSortOrder(leaf.view.sortOrder) ? leaf.view.sortOrder : null;
	}

	detach(): void {
		this.cancelled = true;
		this.stopWatching();
		if (this.uninstaller !== null) {
			try {
				this.uninstaller();
			} catch {
				// Uninstall must not throw on unload.
			}
			this.uninstaller = null;
		}
		this.patchedPrototype = null;
		this.requestSort();
	}

	private findExplorerLeaf(): WorkspaceLeaf | null {
		const leaves = this.host.app.workspace.getLeavesOfType(
			FILE_EXPLORER_VIEW_TYPE,
		);
		return leaves[0] ?? null;
	}

	private patchView(view: PatchableFileExplorerView): boolean {
		const prototype = view.constructor.prototype;
		if (this.patchedPrototype === prototype && this.uninstaller !== null) {
			return false;
		}
		if (this.uninstaller !== null) {
			this.uninstaller();
			this.uninstaller = null;
		}
		const host = this.host;
		this.uninstaller = around(prototype, {
			getSortedFolderItems(old) {
				return function (
					this: PatchableFileExplorerView,
					folder: TFolder,
				): ExplorerTreeItem[] {
					const originalFn = old as
						| PatchableFileExplorerView['getSortedFolderItems']
						| undefined;
					if (originalFn === undefined) {
						return [];
					}
					const original = originalFn.call(this, folder);
					return wrapGetSortedFolderItems(
						original,
						this.sortOrder,
						host.settings,
						host.folderTimes,
					);
				};
			},
		});
		this.patchedPrototype = prototype;
		return true;
	}

	private watchDeferred(leaf: WorkspaceLeaf): void {
		if (this.observer !== null) {
			return;
		}
		const parent =
			leaf.view.containerEl.parentElement ??
			activeDocument.querySelector('.workspace');
		if (parent === null) {
			return;
		}
		this.observer = new MutationObserver((): void => {
			if (parent.querySelector(FILE_EXPLORER_READY_SELECTOR) !== null) {
				this.tryAttach();
			}
		});
		this.observer.observe(parent, { childList: true, subtree: false });
	}

	private stopWatching(): void {
		if (this.observer !== null) {
			this.observer.disconnect();
			this.observer = null;
		}
	}
}
