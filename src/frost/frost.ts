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
import {
	frostLines,
	LEVELS,
	type Line,
	pathData,
	type Side,
} from "./crystals.ts";

export interface FrostOptions extends CommonOptions {
	color?: string;
	size?: number;
}

interface Placement {
	pinned: ["top" | "bottom", "left" | "right"];
	outward: [number, number];
	inward: string;
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
const GLOW_SPILL = 300;
const GROW_MS = 5000;
const GROW_EASING = "ease-out";
const REACH = 70;
const BOTTOM_REACH = 1.4;
const FADE = 20;
const PLACEMENTS: Record<Side, Placement> = {
	top: { pinned: ["top", "left"], outward: [0, -1], inward: "to bottom" },
	bottom: { pinned: ["bottom", "left"], outward: [0, 1], inward: "to top" },
	left: { pinned: ["bottom", "left"], outward: [-1, 0], inward: "to right" },
	right: { pinned: ["bottom", "right"], outward: [1, 0], inward: "to left" },
};
const SIDES: Side[] = ["top", "bottom", "left", "right"];

interface Bounds {
	width: number;
	height: number;
}

interface Area extends Bounds {
	x: number;
	y: number;
}

interface Piece {
	side: Side;
	box: HTMLElement;
	inner: HTMLElement;
	svg: SVGElement;
	blur: SVGElement;
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
	path.style.pointerEvents = "none";
	return path;
}

function createGrain(color: string, grainId: string): SVGElement[] {
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
	return [noise, grain];
}

function createBlock(): HTMLElement {
	const block = document.createElement("div");
	block.style.position = "absolute";
	block.style.width = "auto";
	block.style.height = "auto";
	block.style.pointerEvents = "none";
	return block;
}

function createGlow(side: Side, color: string): HTMLElement {
	const glow = createBlock();
	glow.style.inset = `-${GLOW_SPILL}px`;
	glow.style[side] = "0";
	glow.style.boxShadow = `inset 0 -12px 44px color-mix(in srgb, ${color} ${GLOW_SHARE}%, transparent)`;
	return glow;
}

function createPiece(side: Side, color: string): Piece {
	const blurId = uniqueId("frost-blur");
	const grainId = uniqueId("frost-grain");
	const blur = svgElement("filter", {
		id: blurId,
		filterUnits: "userSpaceOnUse",
	});
	blur.append(svgElement("feGaussianBlur", { stdDeviation: CRUST_BLUR }));
	const defs = svgElement("defs", {});
	defs.append(blur, ...createGrain(color, grainId));
	const blurred = createStroke(color, CRUST_WIDTH, CRUST_OPACITY);
	blurred.style.filter = `url(#${blurId})`;
	const grainy = createStroke(`url(#${grainId})`, CRUST_WIDTH, GRAIN_OPACITY);
	const levels = Array.from({ length: LEVELS }, (_, level) =>
		createStroke(color, STROKE_WIDTHS[level] ?? 0.5, OPACITIES[level] ?? 0.6),
	);
	const svg = svgElement("svg", {});
	svg.style.position = "absolute";
	svg.style.top = "0";
	svg.style.left = "0";
	svg.style.display = "block";
	svg.style.pointerEvents = "none";
	svg.append(defs, blurred, grainy, ...levels);

	const inner = createBlock();
	inner.style.inset = "0";
	inner.append(createGlow(side, color), svg);

	const { pinned, inward } = PLACEMENTS[side];
	const box = document.createElement("div");
	box.style.position = "fixed";
	box.style[pinned[0]] = "0";
	box.style[pinned[1]] = "0";
	box.style.overflow = "hidden";
	box.style.pointerEvents = "none";
	box.style.maskImage = `linear-gradient(${inward}, black calc(100% - ${FADE}px), transparent)`;
	box.style.willChange = "transform";
	box.append(inner);
	return { side, box, inner, svg, blur, crust: [blurred, grainy], levels };
}

function thickness(side: Side, size: number): number {
	const reach = REACH * Math.max(size, 1);
	return (side === "bottom" ? reach * BOTTOM_REACH : reach) + FADE;
}

function pieceArea(side: Side, bounds: Bounds, size: number): Area {
	const band = thickness(side, size);
	const { width, height } = bounds;
	if (side === "top") {
		return { x: 0, y: 0, width, height: band };
	}
	if (side === "bottom") {
		return { x: 0, y: height - band, width, height: band };
	}
	if (side === "left") {
		return { x: 0, y: 0, width: band, height };
	}
	return { x: width - band, y: 0, width: band, height };
}

function drawPiece(piece: Piece, lines: Line[], area: Area): void {
	const { x, y, width, height } = area;
	piece.box.style.width = `${width}px`;
	piece.box.style.height = `${height}px`;
	piece.svg.style.width = `${width}px`;
	piece.svg.style.height = `${height}px`;
	piece.svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
	piece.blur.setAttribute("x", String(x));
	piece.blur.setAttribute("y", String(y));
	piece.blur.setAttribute("width", String(width));
	piece.blur.setAttribute("height", String(height));
	const all = pathData(lines);
	for (const path of piece.crust) {
		path.setAttribute("d", all);
	}
	for (const [level, path] of piece.levels.entries()) {
		const own = lines.filter((line) => line.level === level);
		path.setAttribute("d", pathData(own));
	}
}

function screenBounds(): Bounds {
	const { width, height } = screen;
	if (width < height && matchMedia("(orientation: landscape)").matches) {
		return { width: height, height: width };
	}
	return { width, height };
}

function drawingBounds(layer: HTMLElement): Bounds {
	const whole = screenBounds();
	return {
		width: Math.max(whole.width, layer.clientWidth),
		height: Math.max(whole.height, layer.clientHeight),
	};
}

function slide(element: HTMLElement, x: number, y: number): Animation {
	const hidden = `translate(${x * 100}%, ${y * 100}%)`;
	return element.animate([{ transform: hidden }, { transform: "none" }], {
		duration: GROW_MS,
		easing: GROW_EASING,
	});
}

function startGrowth(piece: Piece): Animation[] {
	const [x, y] = PLACEMENTS[piece.side].outward;
	return [slide(piece.box, x, y), slide(piece.inner, -x, -y)];
}

export function frost(options?: FrostOptions): Stop {
	assertBrowser("frost");
	const settings = readOptions("frost", options, ["color", "size", "zIndex"]);
	const color = checkColor("frost", "color", settings.color ?? DEFAULT_COLOR);
	const size = checkPositive("frost", "size", settings.size ?? 1, MAX_SIZE);
	const zIndex = checkInteger("frost", "zIndex", settings.zIndex ?? 9999);
	const layer = createOverlay(zIndex);
	const pieces = SIDES.map((side) => createPiece(side, color));
	layer.append(...pieces.map((piece) => piece.box));
	const seed = Math.floor(Math.random() * 2 ** 32);

	function draw(bounds: Bounds): void {
		const edges = frostLines(bounds.width, bounds.height, size, seed);
		for (const piece of pieces) {
			const area = pieceArea(piece.side, bounds, size);
			drawPiece(piece, edges[piece.side], area);
		}
	}
	let drawn = drawingBounds(layer);
	draw(drawn);

	const controller = new AbortController();
	const growths = pieces.flatMap(startGrowth);

	watchReducedMotion((reduced) => {
		if (!reduced) {
			return;
		}
		for (const growth of growths) {
			growth.finish();
		}
	}, controller.signal);

	const observer = new ResizeObserver(() => {
		const bounds = drawingBounds(layer);
		if (bounds.width === drawn.width && bounds.height === drawn.height) {
			return;
		}
		drawn = bounds;
		draw(drawn);
	});
	observer.observe(layer);

	return () => {
		controller.abort();
		observer.disconnect();
		for (const growth of growths) {
			growth.cancel();
		}
		layer.remove();
	};
}
