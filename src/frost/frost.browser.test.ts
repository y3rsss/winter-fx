import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";
import { switchReducedMotion } from "../../test/reduced-motion.ts";
import { frostLines, type Line, pathData } from "./crystals.ts";
import { frost } from "./frost.ts";

const SEED_PICK = 0.3;
const SEED = 1288490188;

function onLevel(lines: Line[], level: number): Line[] {
	return lines.filter((line) => line.level === level);
}

function frostLayer(): Element {
	const layer = document.body.lastElementChild;
	if (layer === null) {
		throw new Error("the page has no frost layer");
	}
	return layer;
}

function frostSvg(layer = frostLayer()): Element {
	const svg = layer.querySelector("svg");
	if (svg === null) {
		throw new Error("the frost layer has no svg");
	}
	return svg;
}

function frostPaths(layer = frostLayer()): {
	blurred: Element;
	grainy: Element;
	stems: Element;
	branches: Element;
} {
	const [blurred, grainy, stems, branches] =
		frostSvg(layer).querySelectorAll(":scope > path");
	if (
		blurred === undefined ||
		grainy === undefined ||
		stems === undefined ||
		branches === undefined
	) {
		throw new Error("the frost svg needs 4 paths");
	}
	return { blurred, grainy, stems, branches };
}

function growthSizes(): string[] {
	const effect = document.getAnimations()[0]?.effect;
	if (!(effect instanceof KeyframeEffect)) {
		throw new Error("the frost isn't growing");
	}
	return effect.getKeyframes().map((frame) => String(frame.maskSize));
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resizeTo(width: number, height: number): Promise<void> {
	const resized = new Promise((resolve) => {
		addEventListener("resize", resolve, { once: true });
	});
	await page.viewport(width, height);
	await resized;
	await new Promise(requestAnimationFrame);
}

function stemsFor(width: number, height: number): string {
	return pathData(onLevel(frostLines(width, height, 1, SEED), 0));
}

function referenced(paint: string): Element {
	const id = /#([^")]+)/.exec(paint)?.[1];
	const element = document.getElementById(id ?? "");
	if (element === null) {
		throw new Error(`nothing on the page has the id in ${paint}`);
	}
	return element;
}

describe("frost", () => {
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
		vi.useRealTimers();
		vi.restoreAllMocks();
		document.documentElement.style.removeProperty("--brand");
		document.documentElement.style.removeProperty("color-scheme");
		await commands.emulateReducedMotion("no-preference");
		await page.viewport(width, height);
	});

	test("adds one layer at the end of the page", () => {
		const before = document.body.children.length;
		stop = frost();
		expect(document.body.children.length).toBe(before + 1);
		expect(frostLayer().tagName).toBe("DIV");
	});
	test("keeps the layer out of the way", () => {
		stop = frost();
		expect(frostLayer().getAttribute("aria-hidden")).toBe("true");
		expect(getComputedStyle(frostLayer()).pointerEvents).toBe("none");
	});
	test("uses z-index 9999 by default", () => {
		stop = frost();
		expect(getComputedStyle(frostLayer()).zIndex).toBe("9999");
	});
	test("uses the z-index it was given", () => {
		stop = frost({ zIndex: 5 });
		expect(getComputedStyle(frostLayer()).zIndex).toBe("5");
	});
	test("removes the layer when stopped", () => {
		const before = document.body.children.length;
		const stopFrost = frost();
		stopFrost();
		expect(document.body.children.length).toBe(before);
		expect(document.querySelector("svg")).toBeNull();
	});
	test("can be stopped twice", () => {
		const stopFrost = frost();
		stopFrost();
		expect(() => stopFrost()).not.toThrow();
	});
	test("starts fresh after being stopped", () => {
		frost()();
		stop = frost();
		expect(document.querySelectorAll("svg")).toHaveLength(1);
	});
	test("rejects a size over 2 without adding anything", () => {
		const before = document.body.children.length;
		expect(() => {
			stop = frost({ size: 3 });
		}).toThrow(
			new RangeError(
				'winter-fx: frost() setting "size" must be a number greater than 0 and at most 2, got 3',
			),
		);
		expect(document.body.children.length).toBe(before);
	});
	test("accepts a size of 2", () => {
		expect(() => {
			stop = frost({ size: 2 });
		}).not.toThrow();
	});
	test("rejects a color that isn't text without adding anything", () => {
		const before = document.body.children.length;
		expect(() => {
			stop = frost({ color: 5 } as never);
		}).toThrow(
			new TypeError(
				'winter-fx: frost() setting "color" must be a string, got 5',
			),
		);
		expect(document.body.children.length).toBe(before);
	});
	test("rejects a setting it doesn't know without adding anything", () => {
		const before = document.body.children.length;
		expect(() => {
			stop = frost({ colour: "red" } as never);
		}).toThrow(new TypeError('winter-fx: frost() has no setting "colour"'));
		expect(document.body.children.length).toBe(before);
	});

	test("draws with real SVG elements", () => {
		stop = frost();
		expect(frostSvg()).toBeInstanceOf(SVGSVGElement);
		for (const path of Object.values(frostPaths())) {
			expect(path).toBeInstanceOf(SVGPathElement);
		}
	});
	test("covers the whole window", () => {
		stop = frost();
		const box = frostSvg().getBoundingClientRect();
		expect({
			top: box.top,
			left: box.left,
			width: box.width,
			height: box.height,
		}).toEqual({ top: 0, left: 0, width: 1200, height: 800 });
	});
	test("draws in ice blue by default", () => {
		stop = frost();
		const { blurred, stems, branches } = frostPaths();
		for (const path of [blurred, stems, branches]) {
			expect(getComputedStyle(path).stroke).toBe("rgb(111, 147, 189)");
		}
	});
	test("draws in a pale ice blue on dark pages by default", () => {
		document.documentElement.style.setProperty("color-scheme", "dark");
		stop = frost();
		expect(getComputedStyle(frostPaths().stems).stroke).toBe(
			"rgb(228, 239, 255)",
		);
	});
	test("draws every part in the color it was given", () => {
		stop = frost({ color: "#ff0000" });
		const { blurred, grainy, stems, branches } = frostPaths();
		for (const path of [blurred, stems, branches]) {
			expect(getComputedStyle(path).stroke).toBe("rgb(255, 0, 0)");
		}
		const specks = referenced(getComputedStyle(grainy).stroke).querySelector(
			"rect",
		);
		expect(specks && getComputedStyle(specks).fill).toBe("rgb(255, 0, 0)");
		expect(getComputedStyle(frostSvg()).boxShadow).toContain("inset");
	});
	test("draws in a color from a CSS variable", () => {
		document.documentElement.style.setProperty("--brand", "#ff0000");
		stop = frost({ color: "var(--brand)" });
		expect(getComputedStyle(frostPaths().stems).stroke).toBe("rgb(255, 0, 0)");
	});
	test("blurs the crust and fills the grain with noise", () => {
		stop = frost();
		const { blurred, grainy } = frostPaths();
		const blur = referenced(getComputedStyle(blurred).filter);
		expect(blur.querySelector("feGaussianBlur")).toBeInstanceOf(
			SVGFEGaussianBlurElement,
		);
		const specks = referenced(getComputedStyle(grainy).stroke).querySelector(
			"rect",
		);
		const noise = referenced(specks ? getComputedStyle(specks).filter : "");
		expect(noise.querySelector("feTurbulence")).toBeInstanceOf(
			SVGFETurbulenceElement,
		);
	});
	test("draws stems thicker than branches, over the crust", () => {
		stop = frost();
		const { stems, branches } = frostPaths();
		expect(getComputedStyle(stems).strokeWidth).toBe("0.8px");
		expect(getComputedStyle(branches).strokeWidth).toBe("0.5px");
	});
	test("keeps its look under the site's own CSS", () => {
		const siteCss = document.createElement("style");
		siteCss.textContent =
			"svg { width: 1em; height: 1em; } path { fill: currentColor; stroke: black; stroke-width: 5px; opacity: 1; filter: none; }";
		document.head.append(siteCss);
		try {
			stop = frost();
			const box = frostSvg().getBoundingClientRect();
			expect({ width: box.width, height: box.height }).toEqual({
				width: 1200,
				height: 800,
			});
			const { blurred, stems } = frostPaths();
			expect(getComputedStyle(stems).fill).toBe("none");
			expect(getComputedStyle(stems).stroke).toBe("rgb(111, 147, 189)");
			expect(getComputedStyle(stems).strokeWidth).toBe("0.8px");
			expect(getComputedStyle(stems).opacity).toBe("0.8");
			expect(getComputedStyle(blurred).filter).toContain("url(");
		} finally {
			siteCss.remove();
		}
	});
	test("keeps one frost whole when another one is stopped", () => {
		const stopFirst = frost();
		stop = frost();
		const second = frostLayer();
		const ids = [...document.querySelectorAll("[id]")].map(
			(element) => element.id,
		);
		stopFirst();
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
		const { blurred, grainy } = frostPaths(second);
		expect(second.contains(referenced(getComputedStyle(blurred).filter))).toBe(
			true,
		);
		expect(second.contains(referenced(getComputedStyle(grainy).stroke))).toBe(
			true,
		);
	});

	test("grows stems and branches for the window's size", () => {
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost();
		const lines = frostLines(1200, 800, 1, SEED);
		const { stems, branches } = frostPaths();
		expect(stems.getAttribute("d")).toBe(pathData(onLevel(lines, 0)));
		expect(branches.getAttribute("d")).toBe(pathData(onLevel(lines, 1)));
	});
	test("grows the crust along every line", () => {
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost();
		const all = pathData(frostLines(1200, 800, 1, SEED));
		const { blurred, grainy } = frostPaths();
		expect(blurred.getAttribute("d")).toBe(all);
		expect(grainy.getAttribute("d")).toBe(all);
	});
	test("fits a phone-sized window", async () => {
		await page.viewport(390, 844);
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost();
		const lines = frostLines(390, 844, 1, SEED);
		expect(frostPaths().stems.getAttribute("d")).toBe(
			pathData(onLevel(lines, 0)),
		);
	});
	test("grows longer crystals for a bigger size", () => {
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost({ size: 2 });
		const lines = frostLines(1200, 800, 2, SEED);
		expect(frostPaths().stems.getAttribute("d")).toBe(
			pathData(onLevel(lines, 0)),
		);
	});
	test("grows different crystals each time it starts", () => {
		const stopFirst = frost();
		const first = frostPaths().stems.getAttribute("d");
		stopFirst();
		stop = frost();
		expect(first).not.toBe("");
		expect(frostPaths().stems.getAttribute("d")).not.toBe(first);
	});

	test("creeps in from the edges over 5 seconds", () => {
		stop = frost();
		const animations = document.getAnimations();
		expect(animations).toHaveLength(1);
		const effect = animations[0]?.effect;
		if (!(effect instanceof KeyframeEffect)) {
			throw new Error("the growth has no keyframes");
		}
		expect(effect.target).toBe(frostLayer());
		expect(effect.getTiming()).toMatchObject({
			duration: 5000,
			easing: "ease-out",
		});
	});
	test("uncovers 70 px at the top and sides and 98 px at the bottom", () => {
		stop = frost();
		expect(growthSizes()).toEqual([
			"100% 0px, 100% 0px, 0px 100%, 0px 100%",
			"100% 70px, 100% 98px, 70px 100%, 70px 100%",
		]);
	});
	test("uncovers twice as far for size 2", () => {
		stop = frost({ size: 2 });
		expect(growthSizes()[1]).toBe(
			"100% 140px, 100% 196px, 140px 100%, 140px 100%",
		);
	});
	test("leaves no mask and no extra layer once grown", async () => {
		stop = frost();
		expect(getComputedStyle(frostSvg()).willChange).toBe("transform");
		const growth = document.getAnimations()[0];
		growth?.finish();
		await vi.waitFor(() => {
			expect(getComputedStyle(frostSvg()).willChange).toBe("auto");
		});
		expect(document.getAnimations()).toHaveLength(0);
		expect(getComputedStyle(frostLayer()).maskImage).toBe("none");
	});
	test("shows the whole frost at once under reduced motion", async () => {
		await commands.emulateReducedMotion("reduce");
		stop = frost();
		expect(document.getAnimations()).toHaveLength(0);
		expect(getComputedStyle(frostLayer()).maskImage).toBe("none");
		expect(frostPaths().stems.getAttribute("d")).not.toBe("");
	});
	test("jumps to the end when reduced motion gets turned on", async () => {
		stop = frost();
		const growth = document.getAnimations()[0];
		await switchReducedMotion("reduce");
		expect(growth?.playState).toBe("finished");
		expect(document.getAnimations()).toHaveLength(0);
	});
	test("cancels the growth when stopped", () => {
		const stopFrost = frost();
		const growth = document.getAnimations()[0];
		stopFrost();
		expect(growth?.playState).toBe("idle");
	});
	test("ignores reduced motion changes once stopped", async () => {
		stop = frost();
		stop();
		const finish = vi.spyOn(Animation.prototype, "finish");
		await switchReducedMotion("reduce");
		expect(finish).not.toHaveBeenCalled();
	});

	describe("when the window resizes", () => {
		test("regrows the same crystals for the new size", async () => {
			vi.spyOn(Math, "random").mockReturnValueOnce(SEED_PICK);
			stop = frost();
			await resizeTo(600, 800);
			await vi.waitFor(() => {
				expect(frostPaths().stems.getAttribute("d")).toBe(stemsFor(600, 800));
			});
			const all = pathData(frostLines(600, 800, 1, SEED));
			expect(frostPaths().blurred.getAttribute("d")).toBe(all);
		});
		test("regrows when only the height changes", async () => {
			vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
			stop = frost();
			await resizeTo(1200, 700);
			await vi.waitFor(() => {
				expect(frostPaths().stems.getAttribute("d")).toBe(stemsFor(1200, 700));
			});
		});
		test("waits until resizing has stopped for 200 ms", async () => {
			vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
			vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
			stop = frost();
			const { stems } = frostPaths();
			await resizeTo(600, 800);
			vi.advanceTimersByTime(199);
			expect(stems.getAttribute("d")).toBe(stemsFor(1200, 800));
			dispatchEvent(new Event("resize"));
			vi.advanceTimersByTime(199);
			expect(stems.getAttribute("d")).toBe(stemsFor(1200, 800));
			vi.advanceTimersByTime(1);
			expect(stems.getAttribute("d")).toBe(stemsFor(600, 800));
		});
		test("leaves the crystals alone when the size stays the same", async () => {
			stop = frost();
			const draw = vi.spyOn(frostPaths().stems, "setAttribute");
			dispatchEvent(new Event("resize"));
			await wait(300);
			expect(draw).not.toHaveBeenCalled();
		});
		test("doesn't start the growth again", async () => {
			stop = frost();
			const animate = vi.spyOn(Element.prototype, "animate");
			const draw = vi.spyOn(frostPaths().stems, "setAttribute");
			await resizeTo(600, 800);
			await vi.waitFor(() => {
				expect(draw).toHaveBeenCalled();
			});
			expect(animate).not.toHaveBeenCalled();
		});
		test("regrows nothing when stopped during the wait", async () => {
			stop = frost();
			const draw = vi.spyOn(frostPaths().stems, "setAttribute");
			await resizeTo(600, 800);
			stop();
			await wait(300);
			expect(draw).not.toHaveBeenCalled();
		});
		test("ignores it once stopped", async () => {
			stop = frost();
			const draw = vi.spyOn(frostPaths().stems, "setAttribute");
			stop();
			await resizeTo(600, 800);
			await wait(300);
			expect(draw).not.toHaveBeenCalled();
		});
	});
});
