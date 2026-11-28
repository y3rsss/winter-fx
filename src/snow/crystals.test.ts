import { describe, expect, test, vi } from "vitest";
import {
	addCrystal,
	CLUMP_A,
	CLUMP_B,
	type Crystal,
	createCrystal,
	crystalMatrix,
	pickKind,
	rotatedCopies,
	SECTORED_PLATE,
	type Segment,
	STELLAR_DENDRITE,
	STELLAR_PLATE,
} from "./crystals.ts";

function expectSegments(actual: Segment[], expected: Segment[]): void {
	expect(actual).toHaveLength(expected.length);
	for (const [index, segment] of expected.entries()) {
		for (const [end, value] of segment.entries()) {
			expect(actual[index]?.[end]).toBeCloseTo(value);
		}
	}
}

const UP: Segment = [0, 0, 0, -1];

describe("rotatedCopies", () => {
	test("gives the segments as they are for 1 copy", () => {
		expectSegments(rotatedCopies([UP], 1), [UP]);
	});
	test("turns the second copy 60 degrees clockwise", () => {
		expectSegments(rotatedCopies([UP], 2), [UP, [0, 0, 0.866, -0.5]]);
	});
	test("goes all the way round with 6 copies", () => {
		expectSegments(rotatedCopies([UP], 6), [
			UP,
			[0, 0, 0.866, -0.5],
			[0, 0, 0.866, 0.5],
			[0, 0, 0, 1],
			[0, 0, -0.866, 0.5],
			[0, 0, -0.866, -0.5],
		]);
	});
	test("makes the 3 lines through the middle of a star from one", () => {
		expectSegments(rotatedCopies([[0, -1, 0, 1]], 3), [
			[0, -1, 0, 1],
			[0.866, -0.5, -0.866, 0.5],
			[0.866, 0.5, -0.866, -0.5],
		]);
	});
	test("turns both ends of a segment that starts away from the middle", () => {
		expectSegments(rotatedCopies([[0, -0.5, 0.5, -0.5]], 2), [
			[0, -0.5, 0.5, -0.5],
			[0.433, -0.25, 0.683, 0.183],
		]);
	});
	test("copies every segment, one whole copy after another", () => {
		const branch: Segment = [0, -0.5, 0.3, -0.7];
		expectSegments(rotatedCopies([UP, branch], 2), [
			UP,
			branch,
			[0, 0, 0.866, -0.5],
			[0.433, -0.25, 0.756, -0.09],
		]);
	});
	test("gives nothing for 0 copies", () => {
		expect(rotatedCopies([UP], 0)).toEqual([]);
	});
});

const DIAMETERS: Segment[] = [
	[0, -1, 0, 1],
	[0.866, -0.5, -0.866, 0.5],
	[0.866, 0.5, -0.866, -0.5],
];

describe("crystal kinds", () => {
	test.each([
		{ name: "a stellar dendrite", kind: STELLAR_DENDRITE, details: 24 },
		{ name: "a stellar plate", kind: STELLAR_PLATE, details: 6 },
		{ name: "a sectored plate", kind: SECTORED_PLATE, details: 6 },
	])(
		"$name is the 3 lines through the middle plus $details details, and only those 3 when small",
		({ kind, details }) => {
			expect(kind.lines).toHaveLength(3 + details);
			expectSegments(kind.lines.slice(0, 3), DIAMETERS);
			expectSegments([...kind.smallLines], DIAMETERS);
		},
	);
	test.each([
		{ name: "clump A", kind: CLUMP_A },
		{ name: "clump B", kind: CLUMP_B },
	])("$name looks the same at any size", ({ kind }) => {
		expect(kind.smallLines).toBe(kind.lines);
	});
	test.each([
		{ name: "a stellar dendrite", kind: STELLAR_DENDRITE },
		{ name: "a stellar plate", kind: STELLAR_PLATE },
		{ name: "a sectored plate", kind: SECTORED_PLATE },
		{ name: "clump A", kind: CLUMP_A },
		{ name: "clump B", kind: CLUMP_B },
	])("$name is no wider than the dot it replaces", ({ kind }) => {
		for (const [x1, y1, x2, y2] of kind.lines) {
			expect(Math.hypot(x1, y1)).toBeLessThanOrEqual(1 + 1e-9);
			expect(Math.hypot(x2, y2)).toBeLessThanOrEqual(1 + 1e-9);
		}
	});
});

describe("pickKind", () => {
	test.each([
		{ pick: 0, name: "a stellar dendrite", kind: STELLAR_DENDRITE },
		{ pick: 0.44, name: "a stellar dendrite", kind: STELLAR_DENDRITE },
		{ pick: 0.45, name: "a stellar plate", kind: STELLAR_PLATE },
		{ pick: 0.69, name: "a stellar plate", kind: STELLAR_PLATE },
		{ pick: 0.7, name: "a sectored plate", kind: SECTORED_PLATE },
		{ pick: 0.79, name: "a sectored plate", kind: SECTORED_PLATE },
		{ pick: 0.8, name: "clump A", kind: CLUMP_A },
		{ pick: 0.89, name: "clump A", kind: CLUMP_A },
		{ pick: 0.9, name: "clump B", kind: CLUMP_B },
		{ pick: 0.99, name: "clump B", kind: CLUMP_B },
	])("pick $pick gives $name", ({ pick, kind }) => {
		expect(pickKind(pick)).toBe(kind);
	});
});

const DEGREE = Math.PI / 180;

describe("createCrystal", () => {
	test("makes the lowest of everything when random gives 0", () => {
		expect(createCrystal(2, () => 0)).toEqual({
			kind: STELLAR_DENDRITE,
			motion: "swing",
			turn: expect.closeTo(0),
			spin: expect.closeTo(-0.25),
			lean: expect.closeTo(10 * DEGREE),
			sway: expect.closeTo(4),
		});
	});
	test("makes the highest of everything when random gives 0.99", () => {
		expect(createCrystal(4, () => 0.99)).toEqual({
			kind: CLUMP_B,
			motion: "spiral",
			turn: expect.closeTo(0.99 * 2 * Math.PI),
			spin: expect.closeTo(0.245),
			lean: expect.closeTo(29.8 * DEGREE),
			sway: expect.closeTo(19.88),
		});
	});
	test.each([
		{ pick: 0.49, motion: "swing" },
		{ pick: 0.5, motion: "spiral" },
	])("random $pick makes it $motion", ({ pick, motion }) => {
		expect(createCrystal(2, () => pick).motion).toBe(motion);
	});
	test("picks each of its 6 values with its own random number", () => {
		const random = vi.fn(() => 0.5);
		createCrystal(2, random);
		expect(random).toHaveBeenCalledTimes(6);
	});
});

function matrix(a: number, b: number, c: number, d: number) {
	return {
		a: expect.closeTo(a),
		b: expect.closeTo(b),
		c: expect.closeTo(c),
		d: expect.closeTo(d),
	};
}

const flat: Crystal = {
	kind: STELLAR_DENDRITE,
	motion: "swing",
	turn: 0,
	spin: 0,
	lean: 0,
	sway: 4,
};
const TIPPED = 60 * DEGREE;

describe("crystalMatrix", () => {
	test.each(["swing", "spiral"] as const)(
		"leaves a flat, unturned %s crystal as it is",
		(motion) => {
			expect(crystalMatrix({ ...flat, motion }, 1)).toEqual(matrix(1, 0, 0, 1));
		},
	);
	test("turns a crystal 90 degrees clockwise, so its top arm points right", () => {
		expect(crystalMatrix({ ...flat, turn: Math.PI / 2 }, 0)).toEqual(
			matrix(0, 1, -1, 0),
		);
	});
	test("turns a spinning crystal further as its sway goes on", () => {
		expect(crystalMatrix({ ...flat, spin: 0.25 }, 2 * Math.PI)).toEqual(
			matrix(0, 1, -1, 0),
		);
	});
	test("narrows a swinging crystal sideways at the end of its rock", () => {
		const swing = { ...flat, lean: TIPPED };
		expect(crystalMatrix(swing, Math.PI / 2)).toEqual(matrix(0.5, 0, 0, 1));
		expect(crystalMatrix(swing, -Math.PI / 2)).toEqual(matrix(0.5, 0, 0, 1));
	});
	test("keeps a swinging crystal flat in the middle of its rock", () => {
		expect(crystalMatrix({ ...flat, lean: TIPPED }, Math.PI)).toEqual(
			matrix(1, 0, 0, 1),
		);
	});
	test("squashes a spiraling crystal top to bottom at phase 0", () => {
		const spiral: Crystal = { ...flat, motion: "spiral", lean: TIPPED };
		expect(crystalMatrix(spiral, 0)).toEqual(matrix(1, 0, 0, 0.5));
	});
	test("squashes a spiraling crystal sideways a quarter turn later", () => {
		const spiral: Crystal = { ...flat, motion: "spiral", lean: TIPPED };
		expect(crystalMatrix(spiral, Math.PI / 2)).toEqual(matrix(0.5, 0, 0, 1));
	});
	test("turns a crystal in its own plane before tipping it", () => {
		const spiral: Crystal = {
			...flat,
			motion: "spiral",
			lean: TIPPED,
			turn: Math.PI / 2,
		};
		expect(crystalMatrix(spiral, 0)).toEqual(matrix(0, 0.5, -1, 0));
	});
});

type PathCall = [name: "moveTo" | "lineTo", x: number, y: number];

function recordPath() {
	const calls: PathCall[] = [];
	const path = {
		moveTo(x: number, y: number) {
			calls.push(["moveTo", x, y]);
		},
		lineTo(x: number, y: number) {
			calls.push(["lineTo", x, y]);
		},
	};
	return { path, calls };
}

function pathCall(name: PathCall[0], x: number, y: number) {
	return [name, expect.closeTo(x), expect.closeTo(y)];
}

const UNCHANGED = { a: 1, b: 0, c: 0, d: 1 };

describe("addCrystal", () => {
	test("draws a flat crystal's line at its spot, sized by its radius", () => {
		const { path, calls } = recordPath();
		addCrystal(path, [UP], UNCHANGED, 100, 50, 4);
		expect(calls).toEqual([
			pathCall("moveTo", 100, 50),
			pathCall("lineTo", 100, 46),
		]);
	});
	test("lifts the pen between lines, so they don't join up", () => {
		const { path, calls } = recordPath();
		addCrystal(path, [UP, [0, -0.5, 0.3, -0.7]], UNCHANGED, 10, 20, 2);
		expect(calls).toEqual([
			pathCall("moveTo", 10, 20),
			pathCall("lineTo", 10, 18),
			pathCall("moveTo", 10, 19),
			pathCall("lineTo", 10.6, 18.6),
		]);
	});
	test("turns the lines with the matrix", () => {
		const { path, calls } = recordPath();
		addCrystal(path, [UP], { a: 0, b: 1, c: -1, d: 0 }, 100, 50, 4);
		expect(calls).toEqual([
			pathCall("moveTo", 100, 50),
			pathCall("lineTo", 104, 50),
		]);
	});
	test("moves (1, 0) to (a, b) and (0, 1) to (c, d), times the radius", () => {
		const { path, calls } = recordPath();
		addCrystal(
			path,
			[[1, 0, 0, 1]],
			{ a: 0.1, b: 0.2, c: 0.3, d: 0.4 },
			100,
			50,
			10,
		);
		expect(calls).toEqual([
			pathCall("moveTo", 101, 52),
			pathCall("lineTo", 103, 54),
		]);
	});
	test("adds nothing for no lines", () => {
		const { path, calls } = recordPath();
		addCrystal(path, [], UNCHANGED, 100, 50, 4);
		expect(calls).toEqual([]);
	});
});
