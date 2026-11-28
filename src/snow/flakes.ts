import { between, type Random } from "../shared/random.ts";
import { type Crystal, createCrystal } from "./crystals.ts";

export const SHAPES = ["dot", "crystal"] as const;
export type Shape = (typeof SHAPES)[number];

export interface Bounds {
	width: number;
	height: number;
}

const AREA_PER_FLAKE = 5300;

export function flakeCount(bounds: Bounds, amount: number): number {
	return Math.round(((bounds.width * bounds.height) / AREA_PER_FLAKE) * amount);
}

export interface Layer {
	readonly minRadius: number;
	readonly maxRadius: number;
	readonly minSpeed: number;
	readonly maxSpeed: number;
	readonly opacity: number;
	readonly lineWidth: number;
}

export interface Flake {
	readonly x: number;
	readonly y: number;
	readonly radius: number;
	readonly speed: number;
	readonly layer: Layer;
	readonly phase: number;
	readonly swaySpeed: number;
	readonly crystal?: Crystal;
}

export const BACK: Layer = {
	minRadius: 1,
	maxRadius: 1.5,
	minSpeed: 20,
	maxSpeed: 40,
	opacity: 0.4,
	lineWidth: 0.75,
};
export const MIDDLE: Layer = {
	minRadius: 1.5,
	maxRadius: 2.5,
	minSpeed: 40,
	maxSpeed: 70,
	opacity: 0.7,
	lineWidth: 0.85,
};
export const FRONT: Layer = {
	minRadius: 2.5,
	maxRadius: 4,
	minSpeed: 70,
	maxSpeed: 110,
	opacity: 0.95,
	lineWidth: 1,
};
export const LAYERS: readonly Layer[] = [BACK, MIDDLE, FRONT];

function pickLayer(pick: number): Layer {
	if (pick < 0.5) {
		return BACK;
	} else if (pick < 0.8) {
		return MIDDLE;
	}
	return FRONT;
}

const MIN_CRYSTAL_SWAY_SPEED = 1.25;
const MAX_CRYSTAL_SWAY_SPEED = 2.5;

export function createFlake(
	bounds: Bounds,
	shape: Shape,
	random: Random,
): Flake {
	const layer = pickLayer(random());
	const flake: Flake = {
		x: random() * bounds.width,
		y: random() * bounds.height,
		radius: between(random, layer.minRadius, layer.maxRadius),
		speed: between(random, layer.minSpeed, layer.maxSpeed),
		layer,
		phase: random() * 2 * Math.PI,
		swaySpeed: 0.5 + random(),
	};
	if (shape === "dot") {
		return flake;
	}
	return {
		...flake,
		swaySpeed: between(random, MIN_CRYSTAL_SWAY_SPEED, MAX_CRYSTAL_SWAY_SPEED),
		crystal: createCrystal(flake.radius, random),
	};
}

export function createFlakes(
	count: number,
	bounds: Bounds,
	shape: Shape,
	random: Random,
): Flake[] {
	return Array.from({ length: count }, () =>
		createFlake(bounds, shape, random),
	);
}

const SWAY_PX = 8;

export function swayOffset(flake: Flake): number {
	return Math.sin(flake.phase) * (flake.crystal?.sway ?? SWAY_PX);
}

const MAX_STEP_SECONDS = 0.1;

export function elapsedSeconds(
	previous: number | undefined,
	now: number,
): number {
	if (previous === undefined) return 0;
	return Math.min((now - previous) / 1000, MAX_STEP_SECONDS);
}

export function moveFlake(
	flake: Flake,
	seconds: number,
	speedFactor: number,
	bounds: Bounds,
	shape: Shape,
	random: Random,
): Flake {
	const newY = flake.y + speedFactor * seconds * flake.speed;

	if (newY - flake.radius > bounds.height) {
		const fresh = createFlake(bounds, shape, random);
		return { ...fresh, y: -fresh.radius };
	}
	return { ...flake, y: newY, phase: flake.phase + flake.swaySpeed * seconds };
}

export function resizeFlakes(
	flakes: Flake[],
	bounds: Bounds,
	amount: number,
	shape: Shape,
	random: Random,
): Flake[] {
	const count = flakeCount(bounds, amount);
	const firstFlakes = flakes.slice(0, count);
	const keptFlakes = firstFlakes.map((flake) => {
		if (flake.x >= bounds.width) {
			return { ...flake, x: random() * bounds.width };
		}
		return flake;
	});
	const newFlakes = createFlakes(
		count - keptFlakes.length,
		bounds,
		shape,
		random,
	);
	return [...keptFlakes, ...newFlakes];
}
