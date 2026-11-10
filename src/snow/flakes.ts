export interface Bounds {
	width: number;
	height: number;
}

const AREA_PER_FLAKE = 8000;

export function flakeCount(bounds: Bounds, amount: number): number {
	return Math.round(((bounds.width * bounds.height) / AREA_PER_FLAKE) * amount);
}

export type Random = () => number;
export interface Flake {
	readonly x: number;
	readonly y: number;
	readonly radius: number;
	readonly speed: number;
	readonly opacity: number;
	readonly phase: number;
	readonly swaySpeed: number;
}

interface Layer {
	readonly minRadius: number;
	readonly maxRadius: number;
	readonly minSpeed: number;
	readonly maxSpeed: number;
	readonly opacity: number;
}

const BACK: Layer = {
	minRadius: 1,
	maxRadius: 1.5,
	minSpeed: 20,
	maxSpeed: 40,
	opacity: 0.4,
};
const MIDDLE: Layer = {
	minRadius: 1.5,
	maxRadius: 2.5,
	minSpeed: 40,
	maxSpeed: 70,
	opacity: 0.7,
};
const FRONT: Layer = {
	minRadius: 2.5,
	maxRadius: 4,
	minSpeed: 70,
	maxSpeed: 110,
	opacity: 0.95,
};

function pickLayer(pick: number): Layer {
	if (pick < 0.5) {
		return BACK;
	} else if (pick < 0.8) {
		return MIDDLE;
	}
	return FRONT;
}

export function createFlake(bounds: Bounds, random: Random): Flake {
	const layer = pickLayer(random());
	return {
		x: random() * bounds.width,
		y: random() * bounds.height,
		radius: layer.minRadius + random() * (layer.maxRadius - layer.minRadius),
		speed: layer.minSpeed + random() * (layer.maxSpeed - layer.minSpeed),
		opacity: layer.opacity,
		phase: random() * 2 * Math.PI,
		swaySpeed: 0.5 + random(),
	};
}

export function createFlakes(
	count: number,
	bounds: Bounds,
	random: Random,
): Flake[] {
	return Array.from({ length: count }, () => createFlake(bounds, random));
}
