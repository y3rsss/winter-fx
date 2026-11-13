import { watchReducedMotion } from "../shared/motion.ts";
import {
	type CommonOptions,
	checkColorList,
	checkInteger,
	readOptions,
} from "../shared/options.ts";
import { assertBrowser, createOverlay } from "../shared/overlay.ts";
import type { Stop } from "../shared/stop.ts";
import { svgElement, uniqueId } from "../shared/svg.ts";
import { garlandLayout, type Point } from "./layout.ts";

export interface GarlandOptions extends CommonOptions {
	colors?: readonly string[];
}

const DEFAULT_COLORS = ["#ff4d4d", "#ffcc33", "#4cd964", "#4da6ff"];
const STRIP_HEIGHT = 48;
const WIRE_COLOR = "#2b2b2b";
const CAP_COLOR = "#555555";
const GLOW_BLUR = 4;
const SLOWEST_TWINKLE_MS = 1500;
const DIM_OPACITY = 0.35;

function colorAt(colors: string[], index: number): string {
	const color = colors[index % colors.length];
	if (color === undefined) {
		throw new Error("winter-fx: garland() needs at least one color");
	}
	return color;
}

function createBulb(point: Point, color: string, glowId: string): SVGElement {
	const bulb = svgElement("g", {
		transform: `translate(${point.x} ${point.y})`,
	});
	const glow = svgElement("circle", { cy: 8, r: 9 });
	const body = svgElement("ellipse", { cy: 8, rx: 4, ry: 6 });
	const cap = svgElement("rect", { x: -2, width: 4, height: 3 });
	glow.style.fill = color;
	glow.style.opacity = "0.5";
	glow.style.filter = `url(#${glowId})`;
	body.style.fill = color;
	cap.style.fill = CAP_COLOR;
	bulb.append(glow, body, cap);
	return bulb;
}

function twinkle(bulb: SVGElement): Animation {
	const duration = SLOWEST_TWINKLE_MS + Math.random() * SLOWEST_TWINKLE_MS;
	return bulb.animate([{ opacity: 1 }, { opacity: DIM_OPACITY }], {
		duration,
		delay: Math.random() * duration,
		iterations: Number.POSITIVE_INFINITY,
		direction: "alternate",
		easing: "ease-in-out",
	});
}

export function garland(options?: GarlandOptions): Stop {
	assertBrowser("garland");
	const settings = readOptions("garland", options, ["colors", "zIndex"]);
	const colors = checkColorList(
		"garland",
		"colors",
		settings.colors ?? DEFAULT_COLORS,
	);
	const zIndex = checkInteger("garland", "zIndex", settings.zIndex ?? 9999);
	const layer = createOverlay(zIndex);
	const strip = svgElement("svg", {});
	strip.style.display = "block";
	strip.style.width = "100%";
	strip.style.height = `${STRIP_HEIGHT}px`;
	const glowId = uniqueId("glow");
	const glowFilter = svgElement("filter", {
		id: glowId,
		x: "-100%",
		y: "-100%",
		width: "300%",
		height: "300%",
	});
	glowFilter.append(svgElement("feGaussianBlur", { stdDeviation: GLOW_BLUR }));
	const defs = svgElement("defs", {});
	defs.append(glowFilter);
	const wire = svgElement("path", {});
	wire.style.fill = "none";
	wire.style.stroke = WIRE_COLOR;
	wire.style.strokeWidth = "1.5";
	const lights = svgElement("g", {});
	strip.append(defs, wire, lights);
	layer.append(strip);
	let width = 0;
	let bulbs: SVGElement[] = [];

	function hang(): void {
		width = layer.clientWidth;
		const layout = garlandLayout(width);
		wire.setAttribute("d", layout.wire);
		bulbs = layout.bulbs.map((point, index) =>
			createBulb(point, colorAt(colors, index), glowId),
		);
		lights.replaceChildren(...bulbs);
	}

	hang();

	const controller = new AbortController();
	let twinkles: Animation[] = [];

	function play(): void {
		twinkles = bulbs.map((bulb) => twinkle(bulb));
	}

	function pause(): void {
		for (const t of twinkles) {
			t.cancel();
		}
		twinkles = [];
	}

	watchReducedMotion((reduced) => {
		if (reduced) pause();
		else play();
	}, controller.signal);

	addEventListener(
		"resize",
		() => {
			if (layer.clientWidth === width) {
				return;
			}
			const wasTwinkling = twinkles.length > 0;
			pause();
			hang();
			if (wasTwinkling) play();
		},
		{ signal: controller.signal },
	);

	return () => {
		controller.abort();
		pause();
		layer.remove();
	};
}
