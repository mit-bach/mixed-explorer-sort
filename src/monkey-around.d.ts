declare module 'monkey-around' {
	export function around(
		object: object,
		wrappers: Record<
			string,
			(
				old: ((...args: never[]) => unknown) | undefined,
			) => (...args: never[]) => unknown
		>,
	): () => void;
}
