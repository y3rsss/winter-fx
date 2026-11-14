import { beforeAll, describe, expect, test } from "vitest";
import {
	between,
	frostLines,
	growCrystal,
	type Line,
	pathData,
	seededRandom,
	waveOf,
} from "./crystals.ts";

const hit = 0.1;
const miss = 0.9;
const always = () => 0.5;
const never = () => miss;

function sequence(...values: number[]): () => number {
	let index = 0;
	return () => {
		const value = values[index];
		if (value === undefined) {
			throw new Error(
				`asked for random number ${index + 1}, but the test gave only ${values.length}`,
			);
		}
		index += 1;
		return value;
	};
}

function noRandom(): number {
	throw new Error("asked for a random number, but none should be needed");
}

function angleOf(line: Line): number {
	return Math.atan2(line.to.y - line.from.y, line.to.x - line.from.x);
}

function lengthOf(line: Line): number {
	return Math.hypot(line.to.x - line.from.x, line.to.y - line.from.y);
}

function branchesOf(lines: Line[]): Line[] {
	return lines.filter((line) => line.level === 1);
}

describe("between", () => {
	test("gives the low end for a random number of 0", () => {
		expect(between(() => 0, 2, 6)).toBe(2);
	});

	test("gives the middle for a random number of 0.5", () => {
		expect(between(always, 2, 6)).toBe(4);
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

describe("growCrystal", () => {
	test("starts with the stem, from the start point along the angle", () => {
		const [stem] = growCrystal({ x: 10, y: 20 }, 0, 50, 0, never);
		expect(stem?.from).toEqual({ x: 10, y: 20 });
		expect(stem?.to.x).toBeCloseTo(60);
		expect(stem?.to.y).toBeCloseTo(20);
		expect(stem?.level).toBe(0);
	});

	test("points the stem along any angle", () => {
		const [stem] = growCrystal({ x: 0, y: 0 }, Math.PI / 2, 30, 0, never);
		expect(stem?.to.x).toBeCloseTo(0);
		expect(stem?.to.y).toBeCloseTo(30);
	});

	test("on the last level, gives only the stem and draws no random numbers", () => {
		const lines = growCrystal({ x: 0, y: 0 }, 0, 50, 1, noRandom);
		expect(lines).toHaveLength(1);
		expect(lines[0]?.level).toBe(1);
	});

	test("grows no branches when every side misses its chance", () => {
		expect(growCrystal({ x: 0, y: 0 }, 0, 100, 0, never)).toHaveLength(1);
	});

	test("a random number of exactly 0.6 misses", () => {
		expect(growCrystal({ x: 0, y: 0 }, 0, 100, 0, () => 0.6)).toHaveLength(1);
	});

	test("grows a branch on both sides of 4 spots when every chance hits", () => {
		const lines = growCrystal({ x: 0, y: 0 }, 0, 100, 0, always);
		expect(lines).toHaveLength(9);
		expect(branchesOf(lines)).toHaveLength(8);
	});

	test("puts the spots at 1/5, 2/5, 3/5 and 4/5 along the stem", () => {
		const branches = branchesOf(growCrystal({ x: 0, y: 0 }, 0, 100, 0, always));
		expect(branches.map((line) => Math.round(line.from.x))).toEqual([
			20, 20, 40, 40, 60, 60, 80, 80,
		]);
		expect(branches.every((line) => Math.abs(line.from.y) < 1e-9)).toBe(true);
	});

	test("turns branches 60 degrees toward the tip, first to one side, then the other", () => {
		const branches = branchesOf(growCrystal({ x: 0, y: 0 }, 0, 100, 0, always));
		const sixty = Math.PI / 3;
		const expected = [
			sixty,
			-sixty,
			sixty,
			-sixty,
			sixty,
			-sixty,
			sixty,
			-sixty,
		];
		for (const [index, line] of branches.entries()) {
			expect(angleOf(line)).toBeCloseTo(expected[index] ?? Number.NaN);
		}
	});

	test("makes branches shorter toward the tip", () => {
		const branches = branchesOf(growCrystal({ x: 0, y: 0 }, 0, 100, 0, always));
		const expected = [36.12, 36.12, 30.24, 30.24, 24.36, 24.36, 18.48, 18.48];
		for (const [index, line] of branches.entries()) {
			expect(lengthOf(line)).toBeCloseTo(expected[index] ?? Number.NaN);
		}
	});

	test("decides each side on its own, in order: chance, then tilt, then length", () => {
		const random = sequence(
			miss,
			hit,
			0.5,
			0.5,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
		);
		const lines = growCrystal({ x: 0, y: 0 }, 0, 100, 0, random);
		expect(lines).toHaveLength(2);
		const [branch] = branchesOf(lines);
		expect(branch?.from.x).toBeCloseTo(20);
		expect(angleOf(branch as Line)).toBeCloseTo(-Math.PI / 3);
	});

	test("tilts a branch by up to 0.15 either way", () => {
		const leanBack = sequence(
			hit,
			0,
			0.5,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
		);
		const leanOut = sequence(
			hit,
			1,
			0.5,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
		);
		const [, back] = growCrystal({ x: 0, y: 0 }, 0, 100, 0, leanBack);
		const [, out] = growCrystal({ x: 0, y: 0 }, 0, 100, 0, leanOut);
		expect(angleOf(back as Line)).toBeCloseTo(Math.PI / 3 - 0.15);
		expect(angleOf(out as Line)).toBeCloseTo(Math.PI / 3 + 0.15);
	});

	test("varies a branch's length from 0.7 to 1.3 times", () => {
		const short = sequence(
			hit,
			0.5,
			0,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
		);
		const long = sequence(
			hit,
			0.5,
			1,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
		);
		const [, shortest] = growCrystal({ x: 0, y: 0 }, 0, 100, 0, short);
		const [, longest] = growCrystal({ x: 0, y: 0 }, 0, 100, 0, long);
		expect(lengthOf(shortest as Line)).toBeCloseTo(36.12 * 0.7);
		expect(lengthOf(longest as Line)).toBeCloseTo(36.12 * 1.3);
	});

	test("grows branches from a turned stem too", () => {
		const random = sequence(
			hit,
			0.5,
			0.5,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
			miss,
		);
		const [, branch] = growCrystal({ x: 5, y: 5 }, Math.PI / 2, 100, 0, random);
		expect(branch?.from.x).toBeCloseTo(5);
		expect(branch?.from.y).toBeCloseTo(25);
		expect(angleOf(branch as Line)).toBeCloseTo(Math.PI / 2 + Math.PI / 3);
	});
});

describe("waveOf", () => {
	test("draws one random number per wave, only when it's made", () => {
		const wave = waveOf(sequence(0, 0, 0));
		wave(0.1);
		wave(0.7);
	});

	test("gives 1 at the start of the edge when every phase is 0", () => {
		expect(waveOf(sequence(0, 0, 0))(0)).toBeCloseTo(1);
	});

	test("adds up the 3 waves", () => {
		expect(waveOf(sequence(0, 0, 0))(1 / 12)).toBeCloseTo(1.315);
	});

	test("uses the random numbers as the phases, in order", () => {
		expect(waveOf(sequence(0.25, 0, 0))(0)).toBeCloseTo(1.35);
		expect(waveOf(sequence(0, 0.25, 0))(0)).toBeCloseTo(1.21);
		expect(waveOf(sequence(0, 0, 0.25))(0)).toBeCloseTo(1.14);
	});

	test("gives the same number for the same spot every time", () => {
		const wave = waveOf(sequence(0.1, 0.6, 0.3));
		expect(wave(0.42)).toBe(wave(0.42));
	});

	test("stays between 0.3 and 1.7", () => {
		for (const phase of [0, 0.1, 0.25, 0.5, 0.9]) {
			const wave = waveOf(sequence(phase, 1 - phase, phase / 2));
			for (let share = 0; share <= 1; share += 0.01) {
				expect(wave(share)).toBeGreaterThanOrEqual(0.3);
				expect(wave(share)).toBeLessThanOrEqual(1.7);
			}
		}
	});
});

describe("seededRandom", () => {
	test("gives the same numbers for the same seed", () => {
		const first = seededRandom(42);
		const second = seededRandom(42);
		expect([first(), first(), first()]).toEqual([second(), second(), second()]);
	});

	test("gives numbers from 0 up to 1", () => {
		const random = seededRandom(1);
		for (let i = 0; i < 1000; i += 1) {
			const value = random();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

const WIDTH = 800;
const HEIGHT = 600;
const SEED = 7;

type Side = "top" | "bottom" | "left" | "right";

function crystalsOf(lines: Line[]): Line[][] {
	const crystals: Line[][] = [];
	for (const line of lines) {
		if (line.level === 0) {
			crystals.push([line]);
		} else {
			crystals.at(-1)?.push(line);
		}
	}
	return crystals;
}

function stemOf(crystal: Line[]): Line {
	return crystal[0] as Line;
}

function sideOf(stem: Line, width: number, height: number): Side | "none" {
	if (stem.from.y === 0) return "top";
	if (stem.from.y === height) return "bottom";
	if (stem.from.x === 0) return "left";
	if (stem.from.x === width) return "right";
	return "none";
}

function stemsOn(
	side: Side,
	lines: Line[],
	width = WIDTH,
	height = HEIGHT,
): Line[] {
	return crystalsOf(lines)
		.map(stemOf)
		.filter((stem) => sideOf(stem, width, height) === side);
}

function crystalsOn(
	side: Side,
	lines: Line[],
	width = WIDTH,
	height = HEIGHT,
): Line[][] {
	return crystalsOf(lines).filter(
		(crystal) => sideOf(stemOf(crystal), width, height) === side,
	);
}

function average(numbers: number[]): number {
	return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function expectSameLines(actual: Line[] | undefined, expected: Line[]): void {
	expect(actual).toHaveLength(expected.length);
	for (const [index, line] of expected.entries()) {
		const other = actual?.[index];
		expect(other?.level).toBe(line.level);
		expect(other?.from.x).toBeCloseTo(line.from.x, 6);
		expect(other?.from.y).toBeCloseTo(line.from.y, 6);
		expect(other?.to.x).toBeCloseTo(line.to.x, 6);
		expect(other?.to.y).toBeCloseTo(line.to.y, 6);
	}
}

describe("frostLines", () => {
	let lines: Line[] = [];

	beforeAll(() => {
		lines = frostLines(WIDTH, HEIGHT, 1, SEED);
	});

	test("builds the first two crystals on the top edge exactly like this", () => {
		const random = seededRandom(SEED);
		const wave = waveOf(random);
		const expected: Line[][] = [];
		for (
			let d = between(random, 0, 11);
			expected.length < 2;
			d += between(random, 5, 11)
		) {
			const share = d / WIDTH;
			const fromMiddle = Math.abs(share - 0.5) * 2;
			const length =
				between(random, 4, 10) *
				0.7 *
				wave(share) *
				(1 + 0.8 * fromMiddle ** 4);
			const angle = Math.PI / 2 + between(random, -0.5, 0.5);
			expected.push(growCrystal({ x: d, y: 0 }, angle, length, 0, random));
		}
		const [first, second] = crystalsOf(lines);
		expectSameLines(first, expected[0] ?? []);
		expectSameLines(second, expected[1] ?? []);
	});

	test("builds the first crystal on the left edge with the third seed and a weight that grows downward", () => {
		const random = seededRandom(SEED + 2);
		const wave = waveOf(random);
		const d = between(random, 0, 11);
		const share = d / HEIGHT;
		const fromMiddle = Math.abs(share - 0.5) * 2;
		const weight = 0.7 + 0.8 * share;
		const length =
			between(random, 4, 10) *
			weight *
			wave(share) *
			(1 + 0.8 * fromMiddle ** 4);
		const angle = between(random, -0.5, 0.5);
		const expected = growCrystal({ x: 0, y: d }, angle, length, 0, random);
		expectSameLines(crystalsOn("left", lines)[0], expected);
	});

	test("gives the same lines for the same seed, and others for another seed", () => {
		expect(frostLines(WIDTH, HEIGHT, 1, SEED)).toEqual(lines);
		expect(frostLines(WIDTH, HEIGHT, 1, SEED + 100)).not.toEqual(lines);
	});

	test("goes edge by edge: top, bottom, left, right", () => {
		const sides = crystalsOf(lines).map((crystal) =>
			sideOf(stemOf(crystal), WIDTH, HEIGHT),
		);
		const order = sides.filter((side, index) => side !== sides[index - 1]);
		expect(order).toEqual(["top", "bottom", "left", "right"]);
	});

	test("spaces crystals 5 to 11 px apart, starting within 11 px of the edge's start", () => {
		for (const [side, position] of [
			["top", (stem: Line) => stem.from.x],
			["left", (stem: Line) => stem.from.y],
		] as const) {
			const spots = stemsOn(side, lines).map(position);
			expect(spots[0]).toBeGreaterThanOrEqual(0);
			expect(spots[0]).toBeLessThan(11);
			for (let i = 1; i < spots.length; i += 1) {
				const gap = (spots[i] ?? 0) - (spots[i - 1] ?? 0);
				expect(gap).toBeGreaterThanOrEqual(5);
				expect(gap).toBeLessThan(11);
			}
		}
	});

	test("fills each edge to its end", () => {
		const top = stemsOn("top", lines).map((stem) => stem.from.x);
		const left = stemsOn("left", lines).map((stem) => stem.from.y);
		expect(top.at(-1)).toBeGreaterThan(WIDTH - 11);
		expect(top.at(-1)).toBeLessThan(WIDTH);
		expect(left.at(-1)).toBeGreaterThan(HEIGHT - 11);
		expect(left.at(-1)).toBeLessThan(HEIGHT);
	});

	test("points every stem inward, give or take 0.5", () => {
		const inward: Record<Side, number> = {
			top: Math.PI / 2,
			bottom: -Math.PI / 2,
			left: 0,
			right: Math.PI,
		};
		for (const side of ["top", "bottom", "left", "right"] as const) {
			for (const stem of stemsOn(side, lines)) {
				const turn = Math.abs(angleOf(stem) - inward[side]);
				const off = Math.min(turn, 2 * Math.PI - turn);
				expect(off).toBeLessThanOrEqual(0.5 + 1e-9);
			}
		}
	});

	test("reaches further at the bottom than at the top", () => {
		const top = average(stemsOn("top", lines).map(lengthOf));
		const bottom = average(stemsOn("bottom", lines).map(lengthOf));
		expect(bottom).toBeGreaterThan(top * 1.5);
	});

	test("makes the sides heavier toward the bottom", () => {
		const left = stemsOn("left", lines);
		const upper = average(
			left.filter((stem) => stem.from.y < HEIGHT / 2).map(lengthOf),
		);
		const lower = average(
			left.filter((stem) => stem.from.y >= HEIGHT / 2).map(lengthOf),
		);
		expect(lower).toBeGreaterThan(upper);
	});

	test("scales every line with size", () => {
		const bigger = frostLines(WIDTH, HEIGHT, 2, SEED);
		expect(bigger).toHaveLength(lines.length);
		for (const [index, line] of lines.entries()) {
			expect(lengthOf(bigger[index] as Line)).toBeCloseTo(
				lengthOf(line) * 2,
				6,
			);
		}
	});

	test("keeps the left edge the same and the top crystals in their spots on a wider screen", () => {
		const wider = frostLines(WIDTH + 200, HEIGHT, 1, SEED);
		expect(crystalsOn("left", wider, WIDTH + 200)).toEqual(
			crystalsOn("left", lines),
		);
		const spots = stemsOn("top", lines).map((stem) => stem.from.x);
		const widerSpots = stemsOn("top", wider, WIDTH + 200).map(
			(stem) => stem.from.x,
		);
		expect(widerSpots.slice(0, spots.length)).toEqual(spots);
	});

	test("gives an edge of length 0 no crystals", () => {
		const noWidth = frostLines(0, HEIGHT, 1, SEED);
		expect(noWidth.length).toBeGreaterThan(0);
		expect(
			crystalsOf(noWidth).every((crystal) => stemOf(crystal).from.x === 0),
		).toBe(true);
		expect(frostLines(0, 0, 1, SEED)).toEqual([]);
	});
});

describe("pathData", () => {
	test("gives an empty string for no lines", () => {
		expect(pathData([])).toBe("");
	});

	test("moves to the start of a line and draws to its end", () => {
		const line = { from: { x: 10, y: 0 }, to: { x: 13, y: 9 }, level: 0 };
		expect(pathData([line])).toBe("M10.0 0.0L13.0 9.0");
	});

	test("rounds every number to one decimal", () => {
		const line = {
			from: { x: 10.04, y: 2.96 },
			to: { x: -3.21, y: 599.99 },
			level: 1,
		};
		expect(pathData([line])).toBe("M10.0 3.0L-3.2 600.0");
	});

	test("puts the lines one after another, in order", () => {
		const lines = [
			{ from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, level: 0 },
			{ from: { x: 2, y: 2 }, to: { x: 3, y: 3 }, level: 1 },
		];
		expect(pathData(lines)).toBe("M0.0 0.0L1.0 1.0M2.0 2.0L3.0 3.0");
	});

	test("draws every line of the frost", () => {
		const lines = frostLines(WIDTH, HEIGHT, 1, SEED);
		expect(pathData(lines).match(/M/g)).toHaveLength(lines.length);
		expect(pathData(lines).match(/L/g)).toHaveLength(lines.length);
	});
});
