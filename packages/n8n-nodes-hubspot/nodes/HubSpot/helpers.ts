export function buildHubSpotUrl(
	base: string,
	path: string,
	params: Record<string, string | string[] | number | boolean | undefined>,
): string {
	const url = new URL(base + path);
	for (const [key, val] of Object.entries(params)) {
		if (val === undefined || val === '' || val === false) continue;
		if (Array.isArray(val)) {
			for (const v of val) url.searchParams.append(key, v);
		} else {
			url.searchParams.set(key, String(val));
		}
	}
	return url.toString();
}
