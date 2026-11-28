import { between, type Random } from "../shared/random.ts";

export type Segment = readonly [x1: number, y1: number, x2: number, y2: number];

const ARM_STEP = Math.PI / 3;

export function rotatedCopies(
	segments: readonly Segment[],
	count: number,
): Segment[] {
	const copies: Segment[] = [];
	for (let k = 0; k < count; k += 1) {
		const angle = k * ARM_STEP;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		for (const [x1, y1, x2, y2] of segments) {
			copies.push([
				x1 * cos - y1 * sin,
				x1 * sin + y1 * cos,
				x2 * cos - y2 * sin,
				x2 * sin + y2 * cos,
			]);
		}
	}
	return copies;
}

export interface CrystalKind {
	readonly lines: readonly Segment[];
	readonly smallLines: readonly Segment[];
}

const PLAIN = rotatedCopies([[0, -1, 0, 1]], 3);

function sixArmed(arm: readonly Segment[]): CrystalKind {
	return { lines: [...PLAIN, ...rotatedCopies(arm, 6)], smallLines: PLAIN };
}

export const STELLAR_DENDRITE = sixArmed([
	[0, -0.42, -0.294, -0.59],
	[0, -0.42, 0.294, -0.59],
	[0, -0.7, -0.208, -0.82],
	[0, -0.7, 0.208, -0.82],
]);
export const STELLAR_PLATE = sixArmed([[0, -0.4, 0.346, -0.2]]);
export const SECTORED_PLATE = sixArmed([[0, -0.9, 0.779, -0.45]]);

const CLUMP_A_LINES: readonly Segment[] = [
	[-0.1, 0.05, 0.75, -0.2],
	[0.05, 0.1, -0.3, -0.7],
	[0, 0, -0.8, 0.15],
	[0.1, -0.05, 0.35, 0.7],
	[-0.05, 0, -0.25, 0.6],
];
export const CLUMP_A: CrystalKind = {
	lines: CLUMP_A_LINES,
	smallLines: CLUMP_A_LINES,
};

const CLUMP_B_LINES: readonly Segment[] = [
	[0, 0.1, 0.6, -0.55],
	[0.05, 0, -0.7, -0.35],
	[-0.1, 0, 0.1, 0.85],
	[0.1, 0.05, 0.85, 0.3],
];
export const CLUMP_B: CrystalKind = {
	lines: CLUMP_B_LINES,
	smallLines: CLUMP_B_LINES,
};

export function pickKind(pick: number): CrystalKind {
	if (pick < 0.45) {
		return STELLAR_DENDRITE;
	} else if (pick < 0.7) {
		return STELLAR_PLATE;
	} else if (pick < 0.8) {
		return SECTORED_PLATE;
	} else if (pick < 0.9) {
		return CLUMP_A;
	}
	return CLUMP_B;
}

export type Motion = "swing" | "spiral";

export interface Crystal {
	readonly kind: CrystalKind;
	readonly motion: Motion;
	readonly turn: number;
	readonly spin: number;
	readonly lean: number;
	readonly sway: number;
}

const FULL_TURN = 2 * Math.PI;
const DEGREE = Math.PI / 180;
const MAX_SPIN = 0.25;
const MIN_LEAN = 10 * DEGREE;
const MAX_LEAN = 30 * DEGREE;
const MIN_SWAY_RADII = 2;
const MAX_SWAY_RADII = 5;

export function createCrystal(radius: number, random: Random): Crystal {
	return {
		kind: pickKind(random()),
		motion: random() < 0.5 ? "swing" : "spiral",
		turn: random() * FULL_TURN,
		spin: between(random, -MAX_SPIN, MAX_SPIN),
		lean: between(random, MIN_LEAN, MAX_LEAN),
		sway: radius * between(random, MIN_SWAY_RADII, MAX_SWAY_RADII),
	};
}

export interface Matrix {
	readonly a: number;
	readonly b: number;
	readonly c: number;
	readonly d: number;
}

const SWING_AXIS = Math.PI / 2;

export function crystalMatrix(crystal: Crystal, phase: number): Matrix {
	const turn = crystal.turn + crystal.spin * phase;
	let axis = SWING_AXIS;
	let tip = crystal.lean * Math.sin(phase);
	if (crystal.motion === "spiral") {
		axis = phase;
		tip = crystal.lean;
	}
	const squash = Math.cos(tip);
	const ca = Math.cos(axis);
	const sa = Math.sin(axis);
	const ct = Math.cos(turn - axis);
	const st = Math.sin(turn - axis);
	return {
		a: ca * ct - sa * squash * st,
		b: sa * ct + ca * squash * st,
		c: -ca * st - sa * squash * ct,
		d: -sa * st + ca * squash * ct,
	};
}

export function addCrystal(
	path: Pick<CanvasPath, "moveTo" | "lineTo">,
	lines: readonly Segment[],
	matrix: Matrix,
	x: number,
	y: number,
	radius: number,
): void {
	const a = matrix.a * radius;
	const b = matrix.b * radius;
	const c = matrix.c * radius;
	const d = matrix.d * radius;
	for (const [x1, y1, x2, y2] of lines) {
		path.moveTo(x + a * x1 + c * y1, y + b * x1 + d * y1);
		path.lineTo(x + a * x2 + c * y2, y + b * x2 + d * y2);
	}
}
