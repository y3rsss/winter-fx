import { commands } from "vitest/browser";

export async function switchReducedMotion(
	value: "reduce" | "no-preference",
): Promise<void> {
	const query = matchMedia("(prefers-reduced-motion: reduce)");
	if (query.matches === (value === "reduce")) {
		throw new Error(`reduced motion is already "${value}"`);
	}
	const changed = new Promise((resolve) => {
		query.addEventListener("change", resolve, { once: true });
	});
	await commands.emulateReducedMotion(value);
	await changed;
}
