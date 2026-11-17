import { describe, expect, test } from "vitest";
import { between } from "./random.ts";

describe("between", () => {
	test("gives the low end for a random number of 0", () => {
		expect(between(() => 0, 2, 6)).toBe(2);
	});

	test("gives the middle for a random number of 0.5", () => {
		expect(between(() => 0.5, 2, 6)).toBe(4);
	});

	test("stays just under the high end for the largest random number", () => {
		const value = between(() => 0.999, 2, 6);
		expect(value).toBeCloseTo(5.996);
		expect(value).toBeLessThan(6);
	});

	test("works for a range around 0", () => {
		expect(between(() => 0.25, -0.2, 0.2)).toBeCloseTo(-0.1);
	});
});
