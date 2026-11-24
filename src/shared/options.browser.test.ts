import { afterEach, describe, expect, test, vi } from "vitest";
import { withoutLightDark } from "../../test/without-light-dark.ts";
import {
	checkColor,
	checkColorList,
	checkInteger,
	checkPositive,
	readOptions,
	themeColor,
} from "./options.ts";

describe("checkInteger", () => {
	test("gives back a whole number unchanged", () => {
		expect(checkInteger("snow", "zIndex", -5)).toBe(-5);
	});
	test("rejects a number written as text", () => {
		expect(() => checkInteger("snow", "zIndex", "2")).toThrow(
			new TypeError(
				'winter-fx: snow() setting "zIndex" must be a number, got "2"',
			),
		);
	});
	test.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
		"rejects %s",
		(value) => {
			expect(() => checkInteger("snow", "zIndex", value)).toThrow(
				new RangeError(
					`winter-fx: snow() setting "zIndex" must be an integer, got ${value}`,
				),
			);
		},
	);
});

describe("checkPositive", () => {
	test("gives back a number above 0 unchanged", () => {
		expect(checkPositive("snow", "amount", 0.5)).toBe(0.5);
	});
	test("allows exactly the max", () => {
		expect(checkPositive("frost", "size", 2, 2)).toBe(2);
	});
	test("rejects a number written as text", () => {
		expect(() => checkPositive("snow", "amount", "2")).toThrow(
			new TypeError(
				'winter-fx: snow() setting "amount" must be a number, got "2"',
			),
		);
	});
	test.each([-1, 0, Number.NaN, Number.POSITIVE_INFINITY])(
		"rejects %s",
		(value) => {
			expect(() => checkPositive("snow", "amount", value)).toThrow(
				new RangeError(
					`winter-fx: snow() setting "amount" must be a number greater than 0, got ${value}`,
				),
			);
		},
	);
	test.each([3, 0])("rejects %s when the max is 2", (value) => {
		expect(() => checkPositive("frost", "size", value, 2)).toThrow(
			new RangeError(
				`winter-fx: frost() setting "size" must be a number greater than 0 and at most 2, got ${value}`,
			),
		);
	});
});

describe("checkColor", () => {
	test("gives back a CSS color unchanged", () => {
		expect(checkColor("snow", "color", "rgb(0 0 0)")).toBe("rgb(0 0 0)");
	});
	test("rejects a number", () => {
		expect(() => checkColor("snow", "color", 5)).toThrow(
			new TypeError(
				'winter-fx: snow() setting "color" must be a string, got 5',
			),
		);
	});
	test("rejects text that isn't a color", () => {
		expect(() => checkColor("snow", "color", "blu")).toThrow(
			new RangeError(
				'winter-fx: snow() setting "color" must be a CSS color, got "blu"',
			),
		);
	});
	test.each(["inherit", "initial", "unset", "revert", "revert-layer"])(
		"rejects the CSS keyword %s, which the browser counts as a color",
		(value) => {
			expect(() => checkColor("frost", "color", value)).toThrow(
				new RangeError(
					`winter-fx: frost() setting "color" must be a CSS color, got "${value}"`,
				),
			);
		},
	);
	test.each(["INHERIT", " unset "])(
		"rejects the keyword %j in any case or with spaces around it",
		(value) => {
			expect(() => checkColor("frost", "color", value)).toThrow(
				new RangeError(
					`winter-fx: frost() setting "color" must be a CSS color, got "${value}"`,
				),
			);
		},
	);
	test("allows currentcolor, which is a real color", () => {
		expect(checkColor("frost", "color", "currentcolor")).toBe("currentcolor");
	});
	test("allows a variable whose name has a keyword in it", () => {
		expect(checkColor("frost", "color", "var(--initial)")).toBe(
			"var(--initial)",
		);
	});
});

describe("themeColor", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("follows the page theme where the browser can", () => {
		expect(themeColor("#000000", "#ffffff")).toBe(
			"light-dark(#000000, #ffffff)",
		);
	});
	test("falls back to the light color in a browser without light-dark()", () => {
		withoutLightDark();
		expect(themeColor("#000000", "#ffffff")).toBe("#000000");
	});
});

describe("checkColorList", () => {
	test("gives back a list of colors unchanged", () => {
		expect(checkColorList("garland", "colors", ["red", "#fff"])).toEqual([
			"red",
			"#fff",
		]);
	});
	test("rejects a single color that isn't in a list", () => {
		expect(() => checkColorList("garland", "colors", "red")).toThrow(
			new TypeError(
				'winter-fx: garland() setting "colors" must be an array, got "red"',
			),
		);
	});
	test("rejects an empty list", () => {
		expect(() => checkColorList("garland", "colors", [])).toThrow(
			new RangeError(
				'winter-fx: garland() setting "colors" must have at least one color, got []',
			),
		);
	});
	test("names the bad color by its place in the list", () => {
		expect(() => checkColorList("garland", "colors", ["red", "nope"])).toThrow(
			new RangeError(
				'winter-fx: garland() setting "colors[1]" must be a CSS color, got "nope"',
			),
		);
	});
	test("rejects a list item that isn't text", () => {
		expect(() => checkColorList("garland", "colors", ["red", 5])).toThrow(
			new TypeError(
				'winter-fx: garland() setting "colors[1]" must be a string, got 5',
			),
		);
	});
	test("rejects a list with a gap in it", () => {
		const withGap = ["red"];
		withGap[2] = "blue";
		expect(() => checkColorList("garland", "colors", withGap)).toThrow(
			new TypeError(
				'winter-fx: garland() setting "colors[1]" must be a string, got undefined',
			),
		);
	});
});

describe("readOptions", () => {
	test("gives no settings when none are passed", () => {
		expect(readOptions("snow", undefined, ["color"])).toEqual({});
	});
	test("gives back the settings it was passed", () => {
		expect(readOptions("snow", { color: "red" }, ["color"])).toEqual({
			color: "red",
		});
	});
	test("allows a setting passed as undefined", () => {
		expect(readOptions("snow", { color: undefined }, ["color"])).toEqual({
			color: undefined,
		});
	});
	test.each([
		{ options: null, shown: "null" },
		{ options: 5, shown: "5" },
		{ options: "red", shown: '"red"' },
		{ options: [], shown: "[]" },
	])("rejects $shown", ({ options, shown }) => {
		expect(() => readOptions("snow", options, ["color"])).toThrow(
			new TypeError(
				`winter-fx: snow() settings must be an object, got ${shown}`,
			),
		);
	});
	test("rejects a setting it doesn't know", () => {
		expect(() => readOptions("snow", { colour: "red" }, ["color"])).toThrow(
			new TypeError('winter-fx: snow() has no setting "colour"'),
		);
	});
});
