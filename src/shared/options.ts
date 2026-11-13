function show(value: unknown): string {
	if (typeof value === "string" || Array.isArray(value)) {
		return JSON.stringify(value);
	}
	return String(value);
}

function settingMessage(
	effect: string,
	name: string,
	rule: string,
	value: unknown,
): string {
	return `winter-fx: ${effect}() setting "${name}" must ${rule}, got ${show(value)}`;
}

export function checkInteger(
	effect: string,
	name: string,
	value: unknown,
): number {
	if (typeof value !== "number") {
		throw new TypeError(settingMessage(effect, name, "be a number", value));
	}
	if (!Number.isInteger(value)) {
		throw new RangeError(settingMessage(effect, name, "be an integer", value));
	}
	return value;
}

export function checkPositive(
	effect: string,
	name: string,
	value: unknown,
	max?: number,
): number {
	if (typeof value !== "number") {
		throw new TypeError(settingMessage(effect, name, "be a number", value));
	}
	let rule = "be a number greater than 0";
	if (max !== undefined) {
		rule += ` and at most ${max}`;
	}
	if (
		!Number.isFinite(value) ||
		value <= 0 ||
		(max !== undefined && value > max)
	) {
		throw new RangeError(settingMessage(effect, name, rule, value));
	}
	return value;
}

export function checkColor(
	effect: string,
	name: string,
	value: unknown,
): string {
	if (typeof value !== "string") {
		throw new TypeError(settingMessage(effect, name, "be a string", value));
	}
	if (!CSS.supports("color", value)) {
		throw new RangeError(settingMessage(effect, name, "be a CSS color", value));
	}
	return value;
}

export function checkColorList(
	effect: string,
	name: string,
	value: unknown,
): string[] {
	if (!Array.isArray(value)) {
		throw new TypeError(settingMessage(effect, name, "be an array", value));
	}
	if (value.length === 0) {
		throw new RangeError(
			settingMessage(effect, name, "have at least one color", value),
		);
	}
	return Array.from(value, (color, index) =>
		checkColor(effect, `${name}[${index}]`, color),
	);
}

export interface CommonOptions {
	zIndex?: number;
}

export function readOptions(
	effect: string,
	options: unknown,
	allowed: readonly string[],
): Record<string, unknown> {
	if (options === undefined) {
		return {};
	}
	if (
		typeof options !== "object" ||
		options === null ||
		Array.isArray(options)
	) {
		throw new TypeError(
			`winter-fx: ${effect}() settings must be an object, got ${show(options)}`,
		);
	}
	for (const key of Object.keys(options)) {
		if (!allowed.includes(key)) {
			throw new TypeError(`winter-fx: ${effect}() has no setting "${key}"`);
		}
	}
	return options as Record<string, unknown>;
}
