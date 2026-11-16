import { watchReducedMotion } from "../shared/motion.ts";
import {
	type CommonOptions,
	checkColor,
	checkInteger,
	checkPositive,
	readOptions,
} from "../shared/options.ts";
import { assertBrowser, createOverlay } from "../shared/overlay.ts";
import type { Stop } from "../shared/stop.ts";
import { svgElement, uniqueId } from "../shared/svg.ts";
import { frostLines, LEVELS, pathData } from "./crystals.ts";

export interface FrostOptions extends CommonOptions {
	color?: string;
	size?: number;
}

const DEFAULT_COLOR = "light-dark(#6f93bd, #e4efff)";
const MAX_SIZE = 2;
const STROKE_WIDTHS = [0.8, 0.5];
const OPACITIES = [0.8, 0.6];
const CRUST_WIDTH = 7;
const CRUST_BLUR = 3.6;
const CRUST_OPACITY = 0.11;
const GRAIN_OPACITY = 0.6;
const GRAIN_TILE = 128;
const GLOW_SHARE = 30;
const GROW_MS = 5000;
const GROW_EASING = "ease-out";
const REGROW_DELAY_MS = 200;
const REACH = 70;
const BOTTOM_REACH = 1.4;
const FADE = 20;
const SIDES = ["to bottom", "to top", "to right", "to left"];

interface Picture {
	svg: SVGElement;
	crust: SVGElement[];
	levels: SVGElement[];
}

function createStroke(
	paint: string,
	width: number,
	opacity: number,
): SVGElement {
	const path = svgElement("path", {});
	path.style.fill = "none";
	path.style.stroke = paint;
	path.style.strokeWidth = String(width);
	path.style.strokeLinecap = "round";
	path.style.opacity = String(opacity);
	return path;
}

function createDefs(
	color: string,
	blurId: string,
	grainId: string,
): SVGElement {
	const blur = svgElement("filter", {
		id: blurId,
		x: "-5%",
		y: "-5%",
		width: "110%",
		height: "110%",
	});
	blur.append(svgElement("feGaussianBlur", { stdDeviation: CRUST_BLUR }));
	const noise = svgElement("filter", {
		id: `${grainId}-noise`,
		x: 0,
		y: 0,
		width: "100%",
		height: "100%",
	});
	noise.append(
		svgElement("feTurbulence", {
			type: "fractalNoise",
			baseFrequency: 0.9,
			numOctaves: 2,
			seed: 4,
			stitchTiles: "stitch",
		}),
		svgElement("feColorMatrix", {
			type: "matrix",
			values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  9 0 0 0 -4.6",
		}),
		svgElement("feComposite", { in: "SourceGraphic", operator: "in" }),
	);
	const specks = svgElement("rect", { width: GRAIN_TILE, height: GRAIN_TILE });
	specks.style.fill = color;
	specks.style.filter = `url(#${grainId}-noise)`;
	const grain = svgElement("pattern", {
		id: grainId,
		width: GRAIN_TILE,
		height: GRAIN_TILE,
		patternUnits: "userSpaceOnUse",
	});
	grain.append(specks);
	const defs = svgElement("defs", {});
	defs.append(blur, noise, grain);
	return defs;
}

function createPicture(color: string): Picture {
	const blurId = uniqueId("frost-blur");
	const grainId = uniqueId("frost-grain");
	const svg = svgElement("svg", {});
	svg.style.display = "block";
	svg.style.width = "100%";
	svg.style.height = "100lvh";
	svg.style.boxShadow = `inset 0 -12px 44px color-mix(in srgb, ${color} ${GLOW_SHARE}%, transparent)`;
	const blurred = createStroke(color, CRUST_WIDTH, CRUST_OPACITY);
	blurred.style.filter = `url(#${blurId})`;
	const grainy = createStroke(`url(#${grainId})`, CRUST_WIDTH, GRAIN_OPACITY);
	const levels = Array.from({ length: LEVELS }, (_, level) =>
		createStroke(color, STROKE_WIDTHS[level] ?? 0.5, OPACITIES[level] ?? 0.6),
	);
	svg.append(createDefs(color, blurId, grainId), blurred, grainy, ...levels);
	return { svg, crust: [blurred, grainy], levels };
}

function maskSize(reach: number): string {
	const bottom = reach * BOTTOM_REACH;
	return `100% ${reach}px, 100% ${bottom}px, ${reach}px 100%, ${reach}px 100%`;
}

function growthKeyframes(size: number): Keyframe[] {
	const edges = {
		maskImage: SIDES.map(
			(side) =>
				`linear-gradient(${side}, black calc(100% - ${FADE}px), transparent)`,
		).join(", "),
		maskRepeat: "no-repeat",
		maskPosition: "top, bottom, left, right",
	};
	return [
		{ ...edges, maskSize: maskSize(0) },
		{ ...edges, maskSize: maskSize(REACH * size) },
	];
}

function startGrowth(
	layer: HTMLElement,
	svg: SVGElement,
	size: number,
): Animation {
	svg.style.willChange = "transform";
	const growth = layer.animate(growthKeyframes(size), {
		duration: GROW_MS,
		easing: GROW_EASING,
	});
	growth.onfinish = () => {
		svg.style.willChange = "";
	};
	return growth;
}

export function frost(options?: FrostOptions): Stop {
	assertBrowser("frost");
	const settings = readOptions("frost", options, ["color", "size", "zIndex"]);
	const color = checkColor("frost", "color", settings.color ?? DEFAULT_COLOR);
	const size = checkPositive("frost", "size", settings.size ?? 1, MAX_SIZE);
	const zIndex = checkInteger("frost", "zIndex", settings.zIndex ?? 9999);
	const layer = createOverlay(zIndex);
	const picture = createPicture(color);
	layer.append(picture.svg);
	const seed = Math.floor(Math.random() * 2 ** 32);
	let width = 0;
	let height = 0;

	function grow(): void {
		width = picture.svg.clientWidth;
		height = picture.svg.clientHeight;
		const lines = frostLines(width, height, size, seed);
		for (const i of picture.crust) {
			i.setAttribute("d", pathData(lines));
		}
		for (const [level, path] of picture.levels.entries()) {
			const own = lines.filter((line) => line.level === level);
			path.setAttribute("d", pathData(own));
		}
	}
	grow();

	const controller = new AbortController();
	const growth = startGrowth(layer, picture.svg, size);

	watchReducedMotion((reduced) => {
		if (reduced) growth.finish();
	}, controller.signal);

	let regrowTimer = 0;

	addEventListener(
		"resize",
		() => {
			clearTimeout(regrowTimer);
			regrowTimer = setTimeout(() => {
				if (
					picture.svg.clientWidth === width &&
					picture.svg.clientHeight === height
				) {
					return;
				}
				grow();
			}, REGROW_DELAY_MS);
		},
		{ signal: controller.signal },
	);

	return () => {
		controller.abort();
		clearTimeout(regrowTimer);
		growth.cancel();
		layer.remove();
	};
}
