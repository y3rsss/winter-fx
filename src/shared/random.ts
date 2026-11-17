export type Random = () => number;

export function between(random: Random, low: number, high: number): number {
	const num = random();
	return low + num * (high - low);
}
