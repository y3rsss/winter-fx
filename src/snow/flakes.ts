export interface Bounds {
	width: number;
	height: number;
}

const AREA_PER_FLAKE = 8000;

export function flakeCount(bounds: Bounds, amount: number): number {
	return Math.round(((bounds.width * bounds.height) / AREA_PER_FLAKE) * amount);
}
