import { vi } from "vitest";

export function withoutLightDark(): void {
	const supports = CSS.supports.bind(CSS);
	vi.spyOn(CSS, "supports").mockImplementation(((
		property: string,
		value?: string,
	) => {
		if (value === undefined) {
			return supports(property);
		}
		return !value.includes("light-dark(") && supports(property, value);
	}) as typeof CSS.supports);
}
