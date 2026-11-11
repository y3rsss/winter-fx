export function watchReducedMotion(
	onChange: (reduced: boolean) => void,
	signal: AbortSignal,
): void {
	const query = matchMedia("(prefers-reduced-motion: reduce)");
	onChange(query.matches);
	query.addEventListener("change", () => onChange(query.matches), { signal });
}
