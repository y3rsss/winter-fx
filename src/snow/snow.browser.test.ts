import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cdp, commands, page } from "vitest/browser";
import { switchReducedMotion } from "../../test/reduced-motion.ts";
import { snow } from "./snow.ts";

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function snowLayer(): Element {
	const layer = document.body.lastElementChild;
	if (layer === null) {
		throw new Error("the page has no snow layer");
	}
	return layer;
}

function snowCanvas(): HTMLCanvasElement {
	const canvas = snowLayer().querySelector("canvas");
	if (canvas === null) {
		throw new Error("the snow layer has no canvas");
	}
	return canvas;
}

function pixelData(canvas: HTMLCanvasElement, x = 0, y = 0): Uint8ClampedArray {
	const context = canvas.getContext("2d");
	if (context === null) {
		throw new Error("the snow canvas has no 2D context");
	}
	return context.getImageData(x, y, canvas.width - x, canvas.height - y).data;
}

function drawnColors(canvas: HTMLCanvasElement, x = 0, y = 0): Set<string> {
	const data = pixelData(canvas, x, y);
	const colors = new Set<string>();
	for (let i = 0; i < data.length; i += 4) {
		if ((data[i + 3] ?? 0) > 0) {
			colors.add(`${data[i]}, ${data[i + 1]}, ${data[i + 2]}`);
		}
	}
	return colors;
}

function opaqueShare(canvas: HTMLCanvasElement): number {
	const data = pixelData(canvas);
	let drawn = 0;
	let opaque = 0;
	for (let i = 3; i < data.length; i += 4) {
		if ((data[i] ?? 0) > 0) {
			drawn += 1;
		}
		if (data[i] === 255) {
			opaque += 1;
		}
	}
	return opaque / drawn;
}

function topDrawnRow(canvas: HTMLCanvasElement): number {
	const data = pixelData(canvas);
	for (let i = 3; i < data.length; i += 4) {
		if ((data[i] ?? 0) > 0) {
			return Math.floor((i - 3) / 4 / canvas.width);
		}
	}
	throw new Error("nothing is drawn on the snow canvas");
}

function sameFlakesEverywhere(): void {
	vi.spyOn(Math, "random").mockReturnValue(0.5);
}

function controlFrames(): (time: number) => void {
	const waiting = new Map<number, FrameRequestCallback>();
	let lastId = 0;
	vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
		lastId += 1;
		waiting.set(lastId, callback);
		return lastId;
	});
	vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
		waiting.delete(id);
	});
	return (time) => {
		const due = [...waiting.values()];
		waiting.clear();
		for (const callback of due) {
			callback(time);
		}
	};
}

async function waitForSnow(): Promise<void> {
	await vi.waitFor(() => {
		expect(drawnColors(snowCanvas()).size).toBeGreaterThan(0);
	});
}

async function emulatePixelRatio(ratio: number): Promise<void> {
	await cdp().send("Emulation.setDeviceMetricsOverride", {
		width: 0,
		height: 0,
		deviceScaleFactor: ratio,
		mobile: false,
	});
}

describe("snow", () => {
	let stop: (() => void) | undefined;

	afterEach(async () => {
		stop?.();
		stop = undefined;
		vi.restoreAllMocks();
		document.documentElement.style.removeProperty("--brand");
		await commands.emulateReducedMotion("no-preference");
		await cdp().send("Emulation.clearDeviceMetricsOverride");
	});

	test("adds one layer at the end of the page", () => {
		const before = document.body.children.length;
		stop = snow();
		expect(document.body.children.length).toBe(before + 1);
		expect(snowLayer().tagName).toBe("DIV");
	});
	test("draws on a canvas inside that layer", () => {
		stop = snow();
		expect(snowLayer().children.length).toBe(1);
		expect(snowCanvas().tagName).toBe("CANVAS");
	});
	test("keeps the layer out of the way", () => {
		stop = snow();
		expect(snowLayer().getAttribute("aria-hidden")).toBe("true");
		expect(getComputedStyle(snowLayer()).pointerEvents).toBe("none");
	});
	test("uses z-index 9999 by default", () => {
		stop = snow();
		expect(getComputedStyle(snowLayer()).zIndex).toBe("9999");
	});
	test("uses the z-index it was given", () => {
		stop = snow({ zIndex: 5 });
		expect(getComputedStyle(snowLayer()).zIndex).toBe("5");
	});
	test("removes the layer when stopped", () => {
		const before = document.body.children.length;
		const stopSnow = snow();
		stopSnow();
		expect(document.body.children.length).toBe(before);
		expect(document.querySelector("canvas")).toBeNull();
	});
	test("can be stopped twice", () => {
		const stopSnow = snow();
		stopSnow();
		expect(() => stopSnow()).not.toThrow();
	});
	test("starts fresh after being stopped", () => {
		snow()();
		stop = snow();
		expect(document.querySelectorAll("canvas")).toHaveLength(1);
	});
	test("rejects a bad setting without adding anything", () => {
		expect(() => snow({ amount: -1 })).toThrow(
			new RangeError(
				'winter-fx: snow() setting "amount" must be a number greater than 0 and at most 3, got -1',
			),
		);
		expect(document.querySelector("canvas")).toBeNull();
	});
	test("rejects a setting it doesn't know without adding anything", () => {
		expect(() => snow({ colour: "red" } as never)).toThrow(
			new TypeError('winter-fx: snow() has no setting "colour"'),
		);
		expect(document.querySelector("canvas")).toBeNull();
	});
	test("rejects an amount above 3", () => {
		expect(() => {
			stop = snow({ amount: 3.5 });
		}).toThrow(
			new RangeError(
				'winter-fx: snow() setting "amount" must be a number greater than 0 and at most 3, got 3.5',
			),
		);
		expect(document.querySelector("canvas")).toBeNull();
	});
	test("rejects a speed above 5", () => {
		expect(() => {
			stop = snow({ speed: 5.5 });
		}).toThrow(
			new RangeError(
				'winter-fx: snow() setting "speed" must be a number greater than 0 and at most 5, got 5.5',
			),
		);
		expect(document.querySelector("canvas")).toBeNull();
	});
	test("accepts an amount of 3 and a speed of 5", () => {
		expect(() => {
			stop = snow({ amount: 3, speed: 5 });
		}).not.toThrow();
	});

	test("fits the canvas to the window", () => {
		stop = snow();
		const ratio = Math.min(devicePixelRatio, 2);
		expect(snowCanvas().width).toBe(Math.round(innerWidth * ratio));
		expect(snowCanvas().height).toBe(Math.round(innerHeight * ratio));
	});
	test("uses at most 2 canvas pixels per CSS pixel", async () => {
		await emulatePixelRatio(3);
		stop = snow();
		expect(snowCanvas().width).toBe(innerWidth * 2);
		expect(snowCanvas().height).toBe(innerHeight * 2);
	});
	test("fails loudly when the browser can't draw on a canvas", () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		expect(() => snow()).toThrow(
			new Error("winter-fx: snow() needs a browser that can draw on a canvas"),
		);
		expect(document.querySelector("canvas")).toBeNull();
	});

	test("draws white flakes by default", async () => {
		stop = snow();
		await waitForSnow();
		expect(drawnColors(snowCanvas())).toEqual(new Set(["255, 255, 255"]));
	});
	test("draws in a color from a CSS variable", async () => {
		document.documentElement.style.setProperty("--brand", "#ff0000");
		stop = snow({ color: "var(--brand)" });
		await waitForSnow();
		expect(drawnColors(snowCanvas())).toEqual(new Set(["255, 0, 0"]));
	});
	test("draws the flakes see-through", async () => {
		stop = snow();
		await waitForSnow();
		expect(opaqueShare(snowCanvas())).toBeLessThan(0.1);
	});
	test("draws across the whole canvas on a high-density screen", async () => {
		await emulatePixelRatio(2);
		stop = snow();
		const canvas = snowCanvas();
		await vi.waitFor(() => {
			expect(
				drawnColors(canvas, canvas.width / 2, canvas.height / 2).size,
			).toBeGreaterThan(0);
		});
	});

	test("keeps the snow moving", async () => {
		stop = snow();
		await waitForSnow();
		const canvas = snowCanvas();
		const first = canvas.toDataURL();
		await vi.waitFor(() => {
			expect(canvas.toDataURL()).not.toBe(first);
		});
	});
	test("clears each frame before drawing the next", () => {
		sameFlakesEverywhere();
		const runFrame = controlFrames();
		stop = snow();
		runFrame(0);
		const start = topDrawnRow(snowCanvas());
		runFrame(100);
		expect(topDrawnRow(snowCanvas())).toBeGreaterThan(start);
	});
	test("falls twice as far at speed 2", () => {
		sameFlakesEverywhere();
		const runFrame = controlFrames();
		function fallenInOneSecond(speed: number): number {
			stop = snow({ speed });
			runFrame(0);
			const start = topDrawnRow(snowCanvas());
			for (let time = 100; time <= 1000; time += 100) {
				runFrame(time);
			}
			const end = topDrawnRow(snowCanvas());
			stop();
			return end - start;
		}
		const normal = fallenInOneSecond(1);
		expect(normal).toBeGreaterThan(0);
		expect(fallenInOneSecond(2)).toBe(normal * 2);
	});
	test("moves the same at any frame rate", () => {
		sameFlakesEverywhere();
		const runFrame = controlFrames();
		function imageAfterOneSecond(frameMs: number): string {
			stop = snow();
			for (let time = 0; time <= 1000; time += frameMs) {
				runFrame(time);
			}
			const image = snowCanvas().toDataURL();
			stop();
			return image;
		}
		expect(imageAfterOneSecond(50)).toBe(imageAfterOneSecond(100));
	});
	test("stops drawing once stopped", async () => {
		stop = snow();
		await waitForSnow();
		const nextFrame = vi.spyOn(window, "requestAnimationFrame");
		stop();
		await wait(100);
		expect(nextFrame).not.toHaveBeenCalled();
	});

	test("waits for reduced motion to be turned off", async () => {
		await commands.emulateReducedMotion("reduce");
		stop = snow();
		await wait(100);
		expect(drawnColors(snowCanvas()).size).toBe(0);
		await commands.emulateReducedMotion("no-preference");
		await waitForSnow();
	});
	test("clears the snow when reduced motion gets turned on", async () => {
		stop = snow();
		await waitForSnow();
		await commands.emulateReducedMotion("reduce");
		await vi.waitFor(() => {
			expect(drawnColors(snowCanvas()).size).toBe(0);
		});
	});
	test("carries on without a jump when reduced motion is turned off", async () => {
		sameFlakesEverywhere();
		const runFrame = controlFrames();
		stop = snow();
		runFrame(0);
		runFrame(100);
		const before = topDrawnRow(snowCanvas());
		await commands.emulateReducedMotion("reduce");
		await vi.waitFor(() => {
			expect(drawnColors(snowCanvas()).size).toBe(0);
		});
		await commands.emulateReducedMotion("no-preference");
		await vi.waitFor(() => {
			runFrame(5000);
			expect(topDrawnRow(snowCanvas())).toBe(before);
		});
	});
	test("ignores reduced motion changes once stopped", async () => {
		const stopSnow = snow();
		stopSnow();
		const nextFrame = vi.spyOn(window, "requestAnimationFrame");
		await switchReducedMotion("reduce");
		await switchReducedMotion("no-preference");
		expect(nextFrame).not.toHaveBeenCalled();
	});

	test("fades in when it starts", () => {
		stop = snow();
		expect(getComputedStyle(snowLayer()).opacity).toBe("0");
		for (const animation of snowLayer().getAnimations()) {
			animation.finish();
		}
		expect(getComputedStyle(snowLayer()).opacity).toBe("1");
	});
	test("leaves no animations behind once stopped", () => {
		const stopSnow = snow();
		stopSnow();
		expect(document.getAnimations()).toHaveLength(0);
	});

	describe("when the window resizes", () => {
		let width = 0;
		let height = 0;

		beforeEach(() => {
			width = innerWidth;
			height = innerHeight;
		});
		afterEach(async () => {
			await page.viewport(width, height);
		});

		test("refits the canvas", async () => {
			stop = snow();
			const ratio = Math.min(devicePixelRatio, 2);
			await page.viewport(300, 200);
			await vi.waitFor(() => {
				expect(snowCanvas().width).toBe(Math.round(300 * ratio));
			});
			expect(snowCanvas().height).toBe(Math.round(200 * ratio));
		});
		test("fills a bigger window with snow", async () => {
			await page.viewport(300, 200);
			stop = snow();
			await waitForSnow();
			const ratio = Math.min(devicePixelRatio, 2);
			await page.viewport(800, 600);
			await vi.waitFor(() => {
				expect(drawnColors(snowCanvas(), 320 * ratio, 0).size).toBeGreaterThan(
					0,
				);
			});
		});
		test("keeps the flakes where they are", async () => {
			sameFlakesEverywhere();
			const runFrame = controlFrames();
			await page.viewport(300, 200);
			stop = snow();
			const canvas = snowCanvas();
			runFrame(0);
			const before = topDrawnRow(canvas);
			const ratio = Math.min(devicePixelRatio, 2);
			await page.viewport(300, 260);
			await vi.waitFor(() => {
				expect(canvas.height).toBe(Math.round(260 * ratio));
			});
			runFrame(0);
			expect(topDrawnRow(canvas)).toBe(before);
		});
		test("ignores it once stopped", async () => {
			stop = snow();
			const canvas = snowCanvas();
			const before = canvas.width;
			stop();
			await page.viewport(300, 200);
			await vi.waitFor(() => {
				expect(innerWidth).toBe(300);
			});
			await wait(100);
			expect(canvas.width).toBe(before);
		});
	});
});
