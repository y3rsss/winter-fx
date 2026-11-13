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
import {
	type Bounds,
	createFlakes,
	elapsedSeconds,
	type Flake,
	flakeCount,
	moveFlake,
	resizeFlakes,
	swayOffset,
} from "./flakes.ts";

export interface SnowOptions extends CommonOptions {
	color?: string;
	amount?: number;
	speed?: number;
}

const MAX_PIXEL_RATIO = 2;
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

function fitCanvas(
	canvas: HTMLCanvasElement,
	context: CanvasRenderingContext2D,
): Bounds {
	const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
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
		context.globalAlpha = flake.opacity;
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

export function snow(options?: SnowOptions): Stop {
	assertBrowser("snow");
	const settings = readOptions("snow", options, [
		"color",
		"amount",
		"speed",
		"zIndex",
	]);

	const color = checkColor("snow", "color", settings.color ?? "#ffffff");
	const amount = checkPositive(
		"snow",
		"amount",
		settings.amount ?? 1,
		MAX_AMOUNT,
	);
	const speed = checkPositive("snow", "speed", settings.speed ?? 1, MAX_SPEED);
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
	let flakes = createFlakes(flakeCount(bounds, amount), bounds, Math.random);
	let last: number | undefined;
	let frame: number | undefined;

	function tick(now: number): void {
		const seconds = elapsedSeconds(last, now);
		last = now;
		flakes = flakes.map((flake) =>
			moveFlake(flake, seconds, speed, bounds, Math.random),
		);

		drawFlakes(context, flakes, bounds, getComputedStyle(canvas).color);

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
			flakes = resizeFlakes(flakes, bounds, amount, Math.random);
		},
		{ signal: controller.signal },
	);

	return () => {
		controller.abort();
		pause();
		layer.remove();
	};
}
