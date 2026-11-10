import { describe, expect, test } from "vitest";
import { flakeCount } from "./flakes.ts";

describe("flakeCount", () => {
	test("fills a desktop screen", () => {
		expect(flakeCount({ width: 1920, height: 1080 }, 1)).toBe(259);
	});
	test("fills a phone screen", () => {
		expect(flakeCount({ width: 390, height: 844 }, 1)).toBe(41);
	});
	test("doubles the flakes with amount 2", () => {
		expect(flakeCount({ width: 1920, height: 1080 }, 2)).toBe(518);
	});
	test("gives no flakes on an empty screen", () => {
		expect(flakeCount({ width: 0, height: 0 }, 1)).toBe(0);
	});
});
