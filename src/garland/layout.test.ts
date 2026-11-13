import { describe, expect, test } from "vitest";
import { garlandLayout } from "./layout.ts";

function swoopCount(wire: string): number {
	return wire.split(" Q ").length - 1;
}

function wireEnd(wire: string): string[] {
	return wire.split(" ").slice(-2);
}

describe("garlandLayout", () => {
	test("hangs one swoop per 120 px", () => {
		expect(garlandLayout(240).wire).toBe("M 0 0 Q 60 32 120 0 Q 180 32 240 0");
	});
	test("rounds to the nearest number of swoops", () => {
		expect(garlandLayout(200).wire).toBe("M 0 0 Q 50 32 100 0 Q 150 32 200 0");
		expect(swoopCount(garlandLayout(1366).wire)).toBe(11);
	});
	test("hangs at least one swoop on a narrow screen", () => {
		expect(garlandLayout(50).wire).toBe("M 0 0 Q 25 32 50 0");
	});
	test("ends exactly at the right edge", () => {
		expect(wireEnd(garlandLayout(899).wire)).toEqual(["899", "0"]);
		expect(wireEnd(garlandLayout(1366).wire)).toEqual(["1366", "0"]);
	});

	test("hangs 3 bulbs on every swoop", () => {
		expect(garlandLayout(1200).bulbs).toHaveLength(30);
		expect(garlandLayout(50).bulbs).toHaveLength(3);
	});
	test("spreads the bulbs across a swoop", () => {
		const bulbs = garlandLayout(1200).bulbs;
		expect(bulbs[0]?.x).toBeCloseTo(20);
		expect(bulbs[1]?.x).toBeCloseTo(60);
		expect(bulbs[2]?.x).toBeCloseTo(100);
	});
	test("hangs each bulb on the wire's curve", () => {
		const bulbs = garlandLayout(1200).bulbs;
		expect(bulbs[0]?.y).toBeCloseTo(8.889);
		expect(bulbs[1]?.y).toBe(16);
		expect(bulbs[2]?.y).toBeCloseTo(8.889);
	});
	test("starts each swoop's bulbs where that swoop starts", () => {
		expect(garlandLayout(1200).bulbs[4]).toEqual({ x: 180, y: 16 });
	});
});
