import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";
import { switchReducedMotion } from "../../test/reduced-motion.ts";
import { garland } from "./garland.ts";
import { garlandLayout } from "./layout.ts";

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function twinkleTiming(animation: Animation): EffectTiming {
	const timing = animation.effect?.getTiming();
	if (timing === undefined) {
		throw new Error("the twinkle has no effect");
	}
	return timing;
}

function garlandLayer(): Element {
	const layer = document.body.lastElementChild;
	if (layer === null) {
		throw new Error("the page has no garland layer");
	}
	return layer;
}

function garlandStrip(): Element {
	const strip = garlandLayer().querySelector("svg");
	if (strip === null) {
		throw new Error("the garland layer has no svg");
	}
	return strip;
}

function garlandWire(): Element {
	const wire = garlandStrip().querySelector("path");
	if (wire === null) {
		throw new Error("the garland has no wire");
	}
	return wire;
}

function bulbBody(index: number): Element {
	const body = garlandStrip().querySelectorAll("ellipse")[index];
	if (body === undefined) {
		throw new Error(`the garland has no bulb ${index}`);
	}
	return body;
}

function bulbFills(count: number): string[] {
	return Array.from(
		{ length: count },
		(_, index) => getComputedStyle(bulbBody(index)).fill,
	);
}

function centerOf(element: Element): { x: number; y: number } {
	const box = element.getBoundingClientRect();
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

describe("garland", () => {
	let stop: (() => void) | undefined;
	let width = 0;
	let height = 0;

	beforeEach(async () => {
		width = innerWidth;
		height = innerHeight;
		await page.viewport(1200, 800);
	});
	afterEach(async () => {
		stop?.();
		stop = undefined;
		vi.restoreAllMocks();
		document.documentElement.style.removeProperty("--brand");
		await commands.emulateReducedMotion("no-preference");
		await page.viewport(width, height);
	});

	test("adds one layer at the end of the page", () => {
		const before = document.body.children.length;
		stop = garland();
		expect(document.body.children.length).toBe(before + 1);
		expect(garlandLayer().tagName).toBe("DIV");
	});
	test("keeps the layer out of the way", () => {
		stop = garland();
		expect(garlandLayer().getAttribute("aria-hidden")).toBe("true");
		expect(getComputedStyle(garlandLayer()).pointerEvents).toBe("none");
	});
	test("uses z-index 9999 by default", () => {
		stop = garland();
		expect(getComputedStyle(garlandLayer()).zIndex).toBe("9999");
	});
	test("uses the z-index it was given", () => {
		stop = garland({ zIndex: 5 });
		expect(getComputedStyle(garlandLayer()).zIndex).toBe("5");
	});
	test("removes the layer when stopped", () => {
		const before = document.body.children.length;
		const stopGarland = garland();
		stopGarland();
		expect(document.body.children.length).toBe(before);
		expect(document.querySelector("svg")).toBeNull();
	});
	test("can be stopped twice", () => {
		const stopGarland = garland();
		stopGarland();
		expect(() => stopGarland()).not.toThrow();
	});
	test("starts fresh after being stopped", () => {
		garland()();
		stop = garland();
		expect(document.querySelectorAll("svg")).toHaveLength(1);
	});
	test("rejects an empty color list without adding anything", () => {
		const before = document.body.children.length;
		expect(() => {
			stop = garland({ colors: [] });
		}).toThrow(
			new RangeError(
				'winter-fx: garland() setting "colors" must have at least one color, got []',
			),
		);
		expect(document.body.children.length).toBe(before);
	});
	test("rejects a setting it doesn't know without adding anything", () => {
		const before = document.body.children.length;
		expect(() => {
			stop = garland({ colour: ["red"] } as never);
		}).toThrow(new TypeError('winter-fx: garland() has no setting "colour"'));
		expect(document.body.children.length).toBe(before);
	});

	test("draws with real SVG elements", () => {
		stop = garland();
		expect(garlandStrip()).toBeInstanceOf(SVGSVGElement);
		expect(garlandWire()).toBeInstanceOf(SVGPathElement);
	});
	test("draws a 48 px strip across the top of the window", () => {
		stop = garland();
		const strip = garlandStrip().getBoundingClientRect();
		expect({
			top: strip.top,
			width: strip.width,
			height: strip.height,
		}).toEqual({ top: 0, width: 1200, height: 48 });
	});
	test("keeps its look under the site's own CSS", () => {
		const siteCss = document.createElement("style");
		siteCss.textContent =
			"svg { width: 1em; height: 1em; } path, rect { fill: currentColor; } circle { opacity: 1; }";
		document.head.append(siteCss);
		try {
			stop = garland();
			const strip = garlandStrip().getBoundingClientRect();
			expect({ width: strip.width, height: strip.height }).toEqual({
				width: 1200,
				height: 48,
			});
			expect(getComputedStyle(garlandWire()).fill).toBe("none");
			const glow = garlandStrip().querySelector("circle");
			const cap = garlandStrip().querySelector("rect");
			if (glow === null || cap === null) {
				throw new Error("the garland has no bulbs");
			}
			expect(getComputedStyle(glow).opacity).toBe("0.5");
			expect(getComputedStyle(cap).fill).toBe("rgb(85, 85, 85)");
		} finally {
			siteCss.remove();
		}
	});
	test("hangs the wire across the window", () => {
		stop = garland();
		expect(garlandWire().getAttribute("d")).toBe(garlandLayout(1200).wire);
	});

	test("hangs a bulb at every point of the layout", () => {
		stop = garland();
		expect(garlandStrip().querySelectorAll("ellipse")).toHaveLength(30);
	});
	test("hangs each bulb from its point on the wire", () => {
		stop = garland();
		const points = garlandLayout(1200).bulbs;
		for (const index of [0, 4]) {
			const center = centerOf(bulbBody(index));
			expect(center.x).toBeCloseTo(points[index]?.x ?? Number.NaN, 0);
			expect(center.y).toBeCloseTo((points[index]?.y ?? Number.NaN) + 8, 0);
		}
	});
	test("uses the four default colors in turn", () => {
		stop = garland();
		expect(bulbFills(5)).toEqual([
			"rgb(255, 77, 77)",
			"rgb(255, 204, 51)",
			"rgb(76, 217, 100)",
			"rgb(77, 166, 255)",
			"rgb(255, 77, 77)",
		]);
	});
	test("cycles through the colors it was given", () => {
		const palette = ["#ff0000", "#0000ff"] as const;
		stop = garland({ colors: palette });
		expect(bulbFills(3)).toEqual([
			"rgb(255, 0, 0)",
			"rgb(0, 0, 255)",
			"rgb(255, 0, 0)",
		]);
	});
	test("draws bulbs in a color from a CSS variable", () => {
		document.documentElement.style.setProperty("--brand", "#ff0000");
		stop = garland({ colors: ["var(--brand)"] });
		expect(bulbFills(1)).toEqual(["rgb(255, 0, 0)"]);
	});
	test("puts a blurred glow in the bulb's color behind each bulb", () => {
		stop = garland();
		const glows = garlandStrip().querySelectorAll("circle");
		expect(glows).toHaveLength(30);
		const glow = glows[0];
		if (glow === undefined) {
			throw new Error("the garland has no glow");
		}
		expect(getComputedStyle(glow).fill).toBe("rgb(255, 77, 77)");
		expect(glow.compareDocumentPosition(bulbBody(0))).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
		const filterId = /#([^")]+)/.exec(getComputedStyle(glow).filter)?.[1];
		const blur = document.getElementById(filterId ?? "");
		expect(blur?.querySelector("feGaussianBlur")).toBeInstanceOf(
			SVGFEGaussianBlurElement,
		);
	});
	test("keeps ids unique with two garlands on the page", () => {
		const stopFirst = garland();
		stop = garland();
		const ids = [...document.querySelectorAll("[id]")].map(
			(element) => element.id,
		);
		stopFirst();
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test("twinkles every bulb", () => {
		stop = garland();
		expect(document.getAnimations()).toHaveLength(30);
	});
	test("dims each whole bulb to 0.35 and back, forever", () => {
		stop = garland();
		const effect = document.getAnimations()[0]?.effect;
		if (!(effect instanceof KeyframeEffect)) {
			throw new Error("the twinkle has no keyframes");
		}
		expect(effect.target).toBe(bulbBody(0).parentElement);
		expect(effect.getKeyframes().map((frame) => frame.opacity)).toEqual([
			"1",
			"0.35",
		]);
		expect(effect.getTiming()).toMatchObject({
			iterations: Number.POSITIVE_INFINITY,
			direction: "alternate",
		});
	});
	test("gives each bulb its own timing", () => {
		stop = garland();
		const timings = document.getAnimations().map(twinkleTiming);
		const durations = timings.map((timing) => Number(timing.duration));
		const delays = timings.map((timing) => timing.delay ?? 0);
		expect(Math.min(...durations)).toBeGreaterThanOrEqual(1500);
		expect(Math.max(...durations)).toBeLessThan(3000);
		expect(new Set(durations).size).toBeGreaterThan(1);
		expect(new Set(delays).size).toBeGreaterThan(1);
		for (const [index, delay] of delays.entries()) {
			expect(delay).toBeGreaterThanOrEqual(0);
			expect(delay).toBeLessThan(durations[index] ?? 0);
		}
	});
	test("cancels every twinkle once stopped", () => {
		stop = garland();
		const twinkles = document.getAnimations();
		stop();
		expect(twinkles.map((animation) => animation.playState)).toEqual(
			Array(30).fill("idle"),
		);
	});
	test("waits for reduced motion to be turned off", async () => {
		await commands.emulateReducedMotion("reduce");
		stop = garland();
		await wait(100);
		expect(document.getAnimations()).toHaveLength(0);
		await commands.emulateReducedMotion("no-preference");
		await vi.waitFor(() => {
			expect(document.getAnimations()).toHaveLength(30);
		});
	});
	test("keeps the bulbs lit when reduced motion gets turned on", async () => {
		stop = garland();
		expect(document.getAnimations()).toHaveLength(30);
		await switchReducedMotion("reduce");
		expect(document.getAnimations()).toHaveLength(0);
		const bulb = bulbBody(0).parentElement;
		if (bulb === null) {
			throw new Error("the bulb has no group");
		}
		expect(getComputedStyle(bulb).opacity).toBe("1");
	});
	test("ignores reduced motion changes once stopped", async () => {
		stop = garland();
		stop();
		const animate = vi.spyOn(Element.prototype, "animate");
		await switchReducedMotion("reduce");
		await switchReducedMotion("no-preference");
		expect(animate).not.toHaveBeenCalled();
	});

	describe("when the window resizes", () => {
		test("rehangs the garland for the new width", async () => {
			stop = garland();
			const oldTwinkles = document.getAnimations();
			await page.viewport(600, 800);
			await vi.waitFor(() => {
				expect(garlandWire().getAttribute("d")).toBe(garlandLayout(600).wire);
			});
			expect(garlandStrip().querySelectorAll("ellipse")).toHaveLength(15);
			expect(document.getAnimations()).toHaveLength(15);
			expect(oldTwinkles.map((animation) => animation.playState)).toEqual(
				Array(30).fill("idle"),
			);
		});
		test("keeps everything when only the height changes", async () => {
			stop = garland();
			await page.viewport(600, 800);
			await vi.waitFor(() => {
				expect(document.getAnimations()).toHaveLength(15);
			});
			const firstBulb = bulbBody(0);
			const twinkles = document.getAnimations();
			await page.viewport(600, 700);
			await vi.waitFor(() => {
				expect(innerHeight).toBe(700);
			});
			await wait(100);
			expect(bulbBody(0)).toBe(firstBulb);
			const after = document.getAnimations();
			expect(after).toHaveLength(15);
			for (const [index, animation] of after.entries()) {
				expect(animation).toBe(twinkles[index]);
			}
		});
		test("stays still after a resize while reduced motion is on", async () => {
			await commands.emulateReducedMotion("reduce");
			stop = garland();
			await page.viewport(600, 800);
			await vi.waitFor(() => {
				expect(garlandStrip().querySelectorAll("ellipse")).toHaveLength(15);
			});
			await wait(100);
			expect(document.getAnimations()).toHaveLength(0);
		});
		test("ignores it once stopped", async () => {
			stop = garland();
			stop();
			const create = vi.spyOn(document, "createElementNS");
			const animate = vi.spyOn(Element.prototype, "animate");
			await page.viewport(600, 800);
			await vi.waitFor(() => {
				expect(innerWidth).toBe(600);
			});
			await wait(100);
			expect(create).not.toHaveBeenCalled();
			expect(animate).not.toHaveBeenCalled();
		});
	});
});
