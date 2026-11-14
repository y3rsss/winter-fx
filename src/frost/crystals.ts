import type { Random } from "../snow/flakes.ts";

export interface Point {
	x: number;
	y: number;
}

export interface Line {
	from: Point;
	to: Point;
	level: number;
}

interface Wave {
	cycles: number;
	height: number;
	phase: number;
}

interface Edge {
	length: number;
	inward: number;
	start: (distance: number) => Point;
	weight: (share: number) => number;
}

export const LEVELS = 2;
const BRANCH_SPOTS = 4;
const BRANCH_CHANCE = 0.6;
const BRANCH_ANGLE = Math.PI / 3;
const ANGLE_SPREAD = 0.15;
const BRANCH_SHARE = 0.42;
const TAPER = 0.7;
const MIN_FACTOR = 0.7;
const MAX_FACTOR = 1.3;
const WAVES = [
	{ cycles: 3, height: 0.35 },
	{ cycles: 7, height: 0.21 },
	{ cycles: 17, height: 0.14 },
];
const MIN_LENGTH = 4;
const MAX_LENGTH = 10;
const MIN_SPACING = 5;
const MAX_SPACING = 11;
const TILT = 0.5;
const CORNER_BOOST = 0.8;
const TOP_WEIGHT = 0.7;
const BOTTOM_WEIGHT = 1.5;

export function seededRandom(seed: number): Random {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

function sideWeight(share: number): number {
	return TOP_WEIGHT + (BOTTOM_WEIGHT - TOP_WEIGHT) * share;
}

function edgesOf(width: number, height: number): Edge[] {
	return [
		{
			length: width,
			inward: Math.PI / 2,
			start: (d) => ({ x: d, y: 0 }),
			weight: () => TOP_WEIGHT,
		},
		{
			length: width,
			inward: -Math.PI / 2,
			start: (d) => ({ x: d, y: height }),
			weight: () => BOTTOM_WEIGHT,
		},
		{
			length: height,
			inward: 0,
			start: (d) => ({ x: 0, y: d }),
			weight: sideWeight,
		},
		{
			length: height,
			inward: Math.PI,
			start: (d) => ({ x: width, y: d }),
			weight: sideWeight,
		},
	];
}

export function between(random: Random, low: number, high: number): number {
	const num = random();
	return low + num * (high - low);
}

function pointAt(start: Point, angle: number, distance: number): Point {
	const x = start.x + Math.cos(angle) * distance;
	const y = start.y + Math.sin(angle) * distance;
	return { x, y };
}

export function growCrystal(
	start: Point,
	angle: number,
	length: number,
	level: number,
	random: Random,
): Line[] {
	const lines: Line[] = [
		{ from: start, to: pointAt(start, angle, length), level },
	];
	if (level === LEVELS - 1) {
		return lines;
	}

	for (let spot = 1; spot <= BRANCH_SPOTS; spot++) {
		const share = spot / (BRANCH_SPOTS + 1);
		const at = pointAt(start, angle, length * share);
		for (const side of [1, -1]) {
			const coin = random();
			if (coin >= BRANCH_CHANCE) {
				continue;
			}
			const turn = BRANCH_ANGLE + between(random, -ANGLE_SPREAD, ANGLE_SPREAD);
			const branchLength =
				length *
				BRANCH_SHARE *
				(1 - share * TAPER) *
				between(random, MIN_FACTOR, MAX_FACTOR);
			lines.push(
				...growCrystal(
					at,
					angle + side * turn,
					branchLength,
					level + 1,
					random,
				),
			);
		}
	}
	return lines;
}

export function waveOf(random: Random): (share: number) => number {
	const waves: Wave[] = [];

	for (const wave of WAVES) {
		waves.push({ cycles: wave.cycles, height: wave.height, phase: random() });
	}
	return (share) => {
		let total = 1;
		for (const wave of waves) {
			total +=
				wave.height *
				Math.sin((share * wave.cycles + wave.phase) * 2 * Math.PI);
		}
		return total;
	};
}

export function frostLines(
	width: number,
	height: number,
	size: number,
	seed: number,
): Line[] {
	const lines: Line[] = [];
	for (const [index, edge] of edgesOf(width, height).entries()) {
		const random = seededRandom(seed + index);
		const wave = waveOf(random);
		for (
			let d = between(random, 0, MAX_SPACING);
			d < edge.length;
			d += between(random, MIN_SPACING, MAX_SPACING)
		) {
			const share = d / edge.length;
			const fromMiddle = Math.abs(share - 0.5) * 2;
			const length =
				size *
				between(random, MIN_LENGTH, MAX_LENGTH) *
				edge.weight(share) *
				wave(share) *
				(1 + CORNER_BOOST * fromMiddle ** 4);
			const angle = edge.inward + between(random, -TILT, TILT);
			lines.push(...growCrystal(edge.start(d), angle, length, 0, random));
		}
	}
	return lines;
}

export function pathData(lines: Line[]): string {
	let data = "";
	for (const { from, to } of lines) {
		data += `M${from.x.toFixed(1)} ${from.y.toFixed(1)}`;
		data += `L${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
	}
	return data;
}
