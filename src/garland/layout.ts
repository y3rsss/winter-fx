export interface Point {
	x: number;
	y: number;
}

export interface GarlandLayout {
	wire: string;
	bulbs: Point[];
}

const HOOK_SPACING = 120;
const SAG = 16;
const BULB_SPOTS = [1 / 6, 1 / 2, 5 / 6];

export function garlandLayout(width: number): GarlandLayout {
	const swoops = Math.max(1, Math.round(width / HOOK_SPACING));
	let wire = "M 0 0";
	const bulbs: Point[] = [];
	for (let i = 0; i < swoops; i += 1) {
		const start = (i * width) / swoops;
		const end = ((i + 1) * width) / swoops;
		wire += ` Q ${(start + end) / 2} ${2 * SAG} ${end} 0`;
		for (const t of BULB_SPOTS) {
			bulbs.push({ x: start + t * (end - start), y: 4 * SAG * t * (1 - t) });
		}
	}
	return { wire, bulbs };
}
