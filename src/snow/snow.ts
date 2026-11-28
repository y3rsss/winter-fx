import { watchReducedMotion } from "../shared/motion.ts";
import {
	type CommonOptions,
	checkChoice,
	checkColor,
	checkInteger,
	checkPositive,
	readOptions,
	themeColor,
} from "../shared/options.ts";
import { assertBrowser, createOverlay } from "../shared/overlay.ts";
import type { Stop } from "../shared/stop.ts";
import { addCrystal, crystalMatrix } from "./crystals.ts";
import {
	type Bounds,
	createFlakes,
	elapsedSeconds,
	type Flake,
	flakeCount,
	LAYERS,
	moveFlake,
	resizeFlakes,
	SHAPES,
	type Shape,
	swayOffset,
} from "./flakes.ts";

export interface SnowOptions extends CommonOptions {
	color?: string;
	amount?: number;
	speed?: number;
	shape?: Shape;
}

const DEFAULT_LIGHT_COLOR = "#7f9cc0";
const DEFAULT_DARK_COLOR = "#ffffff";
const MAX_PIXEL_RATIO = 2;
const DETAIL_FROM_DEVICE_PX = 8;
const FADE_IN_MS = 1000;
const MAX_AMOUNT = 3;
const MAX_SPEED = 5;

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const context = canvas.getContext("2d");
	if (context === null) {
		throw new Error(
			"winter-fx: snow() needs a browser that can draw on a canvas",
		);
	}
	return context;
}

function pixelRatio(): number {
	return Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
}

function fitCanvas(
	canvas: HTMLCanvasElement,
	context: CanvasRenderingContext2D,
): Bounds {
	const ratio = pixelRatio();
	const bounds = { width: canvas.clientWidth, height: canvas.clientHeight };
	canvas.width = Math.round(bounds.width * ratio);
	canvas.height = Math.round(bounds.height * ratio);
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	return bounds;
}

function drawFlakes(
	context: CanvasRenderingContext2D,
	flakes: Flake[],
	bounds: Bounds,
	color: string,
): void {
	context.clearRect(0, 0, bounds.width, bounds.height);
	context.fillStyle = color;
	for (const flake of flakes) {
		context.globalAlpha = flake.layer.opacity;
		context.beginPath();
		context.arc(
			flake.x + swayOffset(flake),
			flake.y,
			flake.radius,
			0,
			2 * Math.PI,
		);
		context.fill();
	}
}

function drawCrystals(
	context: CanvasRenderingContext2D,
	flakes: Flake[],
	bounds: Bounds,
	color: string,
	ratio: number,
): void {
	context.clearRect(0, 0, bounds.width, bounds.height);
	context.strokeStyle = color;
	context.lineCap = "round";
	for (const layer of LAYERS) {
		context.globalAlpha = layer.opacity;
		context.lineWidth = layer.lineWidth;
		context.beginPath();
		for (const flake of flakes) {
			const crystal = flake.crystal;
			if (flake.layer === layer && crystal !== undefined) {
				const detailed = flake.radius * 2 * ratio >= DETAIL_FROM_DEVICE_PX;
				const lines = detailed ? crystal.kind.lines : crystal.kind.smallLines;
				addCrystal(
					context,
					lines,
					crystalMatrix(crystal, flake.phase),
					flake.x + swayOffset(flake),
					flake.y,
					flake.radius,
				);
			}
		}
		context.stroke();
	}
}

export function snow(options?: SnowOptions): Stop {
	assertBrowser("snow");
	const settings = readOptions("snow", options, [
		"color",
		"amount",
		"speed",
		"shape",
		"zIndex",
	]);

	const color = checkColor(
		"snow",
		"color",
		settings.color ?? themeColor(DEFAULT_LIGHT_COLOR, DEFAULT_DARK_COLOR),
	);
	const amount = checkPositive(
		"snow",
		"amount",
		settings.amount ?? 1,
		MAX_AMOUNT,
	);
	const speed = checkPositive("snow", "speed", settings.speed ?? 1, MAX_SPEED);
	const shape = checkChoice("snow", "shape", settings.shape ?? "dot", SHAPES);
	const zIndex = checkInteger("snow", "zIndex", settings.zIndex ?? 9999);

	const canvas = document.createElement("canvas");
	const context = getContext2d(canvas);
	canvas.style.display = "block";
	canvas.style.width = "100%";
	canvas.style.height = "100%";
	canvas.style.color = color;
	const layer = createOverlay(zIndex);
	layer.append(canvas);
	let bounds = fitCanvas(canvas, context);
	const controller = new AbortController();
	let flakes = createFlakes(
		flakeCount(bounds, amount),
		bounds,
		shape,
		Math.random,
	);
	let last: number | undefined;
	let frame: number | undefined;

	function tick(now: number): void {
		const scheduled = frame;
		// firefox 111 can run the reduced motion listener inside this read, so the checks come after it
		const color = getComputedStyle(canvas).color;
		if (frame !== scheduled || frame === undefined || !canvas.isConnected) {
			return;
		}
		const seconds = elapsedSeconds(last, now);
		last = now;
		flakes = flakes.map((flake) =>
			moveFlake(flake, seconds, speed, bounds, shape, Math.random),
		);

		if (shape === "dot") {
			drawFlakes(context, flakes, bounds, color);
		} else {
			drawCrystals(context, flakes, bounds, color, pixelRatio());
		}

		frame = requestAnimationFrame(tick);
	}

	function play(): void {
		last = undefined;
		layer.animate([{ opacity: 0 }, { opacity: 1 }], FADE_IN_MS);
		frame = requestAnimationFrame(tick);
	}

	function pause(): void {
		if (frame !== undefined) {
			cancelAnimationFrame(frame);
			frame = undefined;
		}
		context.clearRect(0, 0, bounds.width, bounds.height);
	}

	watchReducedMotion((reduced) => {
		if (reduced === true) pause();
		else play();
	}, controller.signal);

	addEventListener(
		"resize",
		() => {
			bounds = fitCanvas(canvas, context);
			flakes = resizeFlakes(flakes, bounds, amount, shape, Math.random);
		},
		{ signal: controller.signal },
	);

	return () => {
		controller.abort();
		pause();
		layer.remove();
	};
}
