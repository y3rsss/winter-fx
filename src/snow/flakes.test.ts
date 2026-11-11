import { describe, expect, test } from "vitest";
import {
	createFlake,
	createFlakes,
	elapsedSeconds,
	type Flake,
	flakeCount,
	moveFlake,
	resizeFlakes,
	swayOffset,
} from "./flakes.ts";

const bounds = { width: 1000, height: 800 };
const base: Flake = {
	x: 0,
	y: 0,
	radius: 2,
	speed: 50,
	opacity: 1,
	phase: 0,
	swaySpeed: 1,
};

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
		expect(createFlakes(3, bounds, () => 0)).toEqual([flake, flake, flake]);
	});
});

describe("swayOffset", () => {
	test("is 0 at phase 0", () => {
		expect(swayOffset({ ...base, phase: 0 })).toBe(0);
	});
	test("is 8 at the top of the swing", () => {
		expect(swayOffset({ ...base, phase: Math.PI / 2 })).toBe(8);
	});
	test("moves smoothly between", () => {
		expect(swayOffset({ ...base, phase: Math.PI / 4 })).toBeCloseTo(5.657);
	});
});

describe("elapsedSeconds", () => {
	test("is 0 on the first frame", () => {
		expect(elapsedSeconds(undefined, 500)).toBe(0);
	});
	test("turns milliseconds into seconds", () => {
		expect(elapsedSeconds(1000, 1016)).toBeCloseTo(0.016);
	});
	test("is never more than 0.1 seconds", () => {
		expect(elapsedSeconds(0, 60000)).toBe(0.1);
	});
});

describe("moveFlake", () => {
	test("falls by its speed times the seconds", () => {
		expect(moveFlake({ ...base, y: 100 }, 0.5, 1, bounds, () => 0.5)).toEqual({
			...base,
			y: 125,
			phase: 0.5,
		});
	});
	test("falls twice as fast with speedFactor 2", () => {
		expect(moveFlake({ ...base, y: 100 }, 0.5, 2, bounds, () => 0.5)).toEqual({
			...base,
			y: 150,
			phase: 0.5,
		});
	});
	test("comes back just above the top after falling past the bottom", () => {
		const moved = moveFlake({ ...base, y: 805 }, 0.5, 1, bounds, () => 0.5);
		expect(moved.y).toBe(-2);
		expect(moved.x).toBe(500);
	});
});

describe("resizeFlakes", () => {
	test("keeps the first flakes when the screen gets smaller", () => {
		const flakes = [
			{ ...base, x: 1 },
			{ ...base, x: 2 },
			{ ...base, x: 3 },
		];
		expect(
			resizeFlakes(flakes, { width: 100, height: 160 }, 1, () => 0.5),
		).toEqual([
			{ ...base, x: 1 },
			{ ...base, x: 2 },
		]);
	});
	test("adds flakes when the screen gets bigger", () => {
		expect(
			resizeFlakes([], { width: 1920, height: 1080 }, 1, Math.random).length,
		).toBe(259);
	});
	test("moves a flake past the right edge back inside", () => {
		const resized = resizeFlakes(
			[
				{ ...base, x: 1500 },
				{ ...base, x: 300 },
			],
			bounds,
			1,
			() => 0.5,
		);
		expect(resized.slice(0, 2)).toEqual([
			{ ...base, x: 500 },
			{ ...base, x: 300 },
		]);
	});
	test("counts a flake exactly at the edge as outside", () => {
		const resized = resizeFlakes([{ ...base, x: 1000 }], bounds, 1, () => 0.5);
		expect(resized[0]?.x).toBe(500);
	});
});
