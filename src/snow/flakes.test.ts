import { describe, expect, test } from "vitest";
import { createFlake, createFlakes, flakeCount } from "./flakes.ts";

const bounds = { width: 1000, height: 800 };

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

describe("createFlake", () => {
	test("makes a back flake at the top left when random gives 0", () => {
		expect(createFlake(bounds, () => 0)).toEqual({
			x: 0,
			y: 0,
			radius: 1,
			speed: 20,
			opacity: 0.4,
			phase: 0,
			swaySpeed: 0.5,
		});
	});
	test("makes a front flake when random gives 0.99", () => {
		const flake = createFlake(bounds, () => 0.99);
		expect(flake.opacity).toBe(0.95);
		expect(flake.radius).toBeCloseTo(3.985);
		expect(flake.x).toBe(990);
		expect(flake.y).toBe(792);
	});
	test.each([
		{ pick: 0.49, opacity: 0.4 },
		{ pick: 0.5, opacity: 0.7 },
		{ pick: 0.79, opacity: 0.7 },
		{ pick: 0.8, opacity: 0.95 },
	])("random $pick gives opacity $opacity", ({ pick, opacity }) => {
		expect(createFlake(bounds, () => pick).opacity).toBe(opacity);
	});
});

describe("createFlakes", () => {
	test("makes no flakes for count 0", () => {
		expect(createFlakes(0, bounds, () => 0)).toEqual([]);
	});
	test("makes count flakes", () => {
		const flake = createFlake(bounds, () => 0);
		expect(createFlakes(3, bounds, () => 0)).toEqual([flake]);
	});
});
