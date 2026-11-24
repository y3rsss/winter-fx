import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vitest";
import { commands, page } from "vitest/browser";
import { switchReducedMotion } from "../../test/reduced-motion.ts";
import { frostLines, type Line, pathData, type Side } from "./crystals.ts";
import { frost } from "./frost.ts";

const SEED_PICK = 0.3;
const SEED = 1288490188;
const SIDES: Side[] = ["top", "bottom", "left", "right"];

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

function pieceBox(side: Side, layer = frostLayer()): HTMLElement {
	const box = layer.children[SIDES.indexOf(side)];
	if (!(box instanceof HTMLElement)) {
		throw new Error(`the frost has no ${side} piece`);
	}
	return box;
}

function pieceSvg(side: Side, layer = frostLayer()): Element {
	const svg = pieceBox(side, layer).querySelector("svg");
	if (svg === null) {
		throw new Error(`the ${side} piece has no svg`);
	}
	return svg;
}

function pieceGlow(side: Side): Element {
	const glow = pieceBox(side).firstElementChild?.firstElementChild;
	if (glow === null || glow === undefined) {
		throw new Error(`the ${side} piece has no glow`);
	}
	return glow;
}

function piecePaths(
	side: Side,
	layer = frostLayer(),
): {
	blurred: Element;
	grainy: Element;
	stems: Element;
	branches: Element;
} {
	const [blurred, grainy, stems, branches] = pieceSvg(
		side,
		layer,
	).querySelectorAll(":scope > path");
	if (
		blurred === undefined ||
		grainy === undefined ||
		stems === undefined ||
		branches === undefined
	) {
		throw new Error(`the ${side} svg needs 4 paths`);
	}
	return { blurred, grainy, stems, branches };
}

function edgesFor(
	width: number,
	height: number,
	size = 1,
): Record<Side, Line[]> {
	return frostLines(width, height, size, SEED);
}

function expectDrawn(edges: Record<Side, Line[]>): void {
	for (const side of SIDES) {
		const lines = edges[side];
		const { blurred, grainy, stems, branches } = piecePaths(side);
		expect(stems.getAttribute("d")).toBe(pathData(onLevel(lines, 0)));
		expect(branches.getAttribute("d")).toBe(pathData(onLevel(lines, 1)));
		expect(blurred.getAttribute("d")).toBe(pathData(lines));
		expect(grainy.getAttribute("d")).toBe(pathData(lines));
	}
}

function edgesOf(element: Element): Record<string, number> {
	const { top, right, bottom, left } = element.getBoundingClientRect();
	return { top, right, bottom, left };
}

function useScreen(width: number, height: number): void {
	vi.spyOn(screen, "width", "get").mockReturnValue(width);
	vi.spyOn(screen, "height", "get").mockReturnValue(height);
}

function finishGrowth(): void {
	for (const animation of document.getAnimations()) {
		animation.finish();
	}
}

function growthEffects(): KeyframeEffect[] {
	return document.getAnimations().map((animation) => {
		if (!(animation.effect instanceof KeyframeEffect)) {
			throw new Error("the growth has no keyframes");
		}
		return animation.effect;
	});
}

// headless webkit on windows sometimes stops sending frames to the test page after a resize
function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => resolve());
		setTimeout(resolve, 200);
	});
}

async function framePainted(): Promise<void> {
	await nextFrame();
	await nextFrame();
}

async function resizeTo(width: number, height: number): Promise<void> {
	await page.viewport(width, height);
	await vi.waitFor(() => {
		expect([innerWidth, innerHeight]).toEqual([width, height]);
	});
	await framePainted();
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

	beforeAll(() => {
		width = innerWidth;
		height = innerHeight;
	});
	beforeEach(async () => {
		await page.viewport(1200, 800);
		await vi.waitFor(() => {
			expect([innerWidth, innerHeight]).toEqual([1200, 800]);
		});
		await framePainted();
		useScreen(1200, 800);
	});
	afterEach(async () => {
		stop?.();
		stop = undefined;
		vi.restoreAllMocks();
		document.documentElement.style.removeProperty("--brand");
		document.documentElement.style.removeProperty("color-scheme");
		await commands.emulateReducedMotion("no-preference");
	});
	afterAll(async () => {
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
		finishGrowth();
		for (const side of SIDES) {
			const { left, top } = pieceSvg(side).getBoundingClientRect();
			const hit = document.elementFromPoint(left + 5, top + 5);
			expect(frostLayer().contains(hit)).toBe(false);
		}
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
		expect(document.querySelectorAll("svg")).toHaveLength(4);
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
		for (const side of SIDES) {
			expect(pieceSvg(side)).toBeInstanceOf(SVGSVGElement);
			for (const path of Object.values(piecePaths(side))) {
				expect(path).toBeInstanceOf(SVGPathElement);
			}
		}
	});
	test("puts a piece along every edge of the window", () => {
		stop = frost();
		finishGrowth();
		expect(edgesOf(pieceBox("top"))).toEqual({
			top: 0,
			right: 1200,
			bottom: 90,
			left: 0,
		});
		expect(edgesOf(pieceBox("bottom"))).toEqual({
			top: 682,
			right: 1200,
			bottom: 800,
			left: 0,
		});
		expect(edgesOf(pieceBox("left"))).toEqual({
			top: 0,
			right: 90,
			bottom: 800,
			left: 0,
		});
		expect(edgesOf(pieceBox("right"))).toEqual({
			top: 0,
			right: 1200,
			bottom: 800,
			left: 1110,
		});
	});
	test("draws in ice blue by default", () => {
		stop = frost();
		for (const side of SIDES) {
			const { blurred, stems, branches } = piecePaths(side);
			for (const path of [blurred, stems, branches]) {
				expect(getComputedStyle(path).stroke).toBe("rgb(111, 147, 189)");
			}
		}
	});
	test("draws in a pale ice blue on dark pages by default", () => {
		document.documentElement.style.setProperty("color-scheme", "dark");
		stop = frost();
		expect(getComputedStyle(piecePaths("bottom").stems).stroke).toBe(
			"rgb(228, 239, 255)",
		);
	});
	test("draws every part in the color it was given", () => {
		stop = frost({ color: "#ff0000" });
		for (const side of SIDES) {
			const { blurred, grainy, stems, branches } = piecePaths(side);
			for (const path of [blurred, stems, branches]) {
				expect(getComputedStyle(path).stroke).toBe("rgb(255, 0, 0)");
			}
			const specks = referenced(getComputedStyle(grainy).stroke).querySelector(
				"rect",
			);
			expect(specks && getComputedStyle(specks).fill).toBe("rgb(255, 0, 0)");
			const glow = getComputedStyle(pieceGlow(side)).boxShadow;
			expect(glow).toContain("inset");
			expect(glow).toContain("color(srgb 1 0 0 / 0.3)");
		}
	});
	test("draws in a color from a CSS variable", () => {
		document.documentElement.style.setProperty("--brand", "#ff0000");
		stop = frost({ color: "var(--brand)" });
		expect(getComputedStyle(piecePaths("left").stems).stroke).toBe(
			"rgb(255, 0, 0)",
		);
	});
	test("glows only along its own edge", () => {
		stop = frost();
		finishGrowth();
		for (const side of SIDES) {
			const piece = edgesOf(pieceBox(side));
			const glow = edgesOf(pieceGlow(side));
			for (const edge of ["top", "right", "bottom", "left"] as const) {
				if (edge === side) {
					expect(glow[edge]).toBe(piece[edge]);
				} else if (edge === "top" || edge === "left") {
					expect(glow[edge]).toBeLessThan((piece[edge] ?? 0) - 100);
				} else {
					expect(glow[edge]).toBeGreaterThan((piece[edge] ?? 0) + 100);
				}
			}
		}
	});
	test("blurs the crust and fills the grain with noise", () => {
		stop = frost();
		const { blurred, grainy } = piecePaths("top");
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
		const { stems, branches } = piecePaths("right");
		expect(getComputedStyle(stems).strokeWidth).toBe("0.8px");
		expect(getComputedStyle(branches).strokeWidth).toBe("0.5px");
	});
	test("keeps its look under the site's own CSS", () => {
		const siteCss = document.createElement("style");
		siteCss.textContent =
			"div { position: static; overflow: visible; width: 10px; height: 10px; pointer-events: auto; } svg { width: 1em; height: 1em; pointer-events: auto; } path { fill: currentColor; stroke: black; stroke-width: 5px; opacity: 1; filter: none; pointer-events: auto; }";
		document.head.append(siteCss);
		try {
			stop = frost();
			finishGrowth();
			for (const side of SIDES) {
				const piece = edgesOf(pieceBox(side));
				expect(edgesOf(pieceSvg(side))).toEqual(piece);
				expect(edgesOf(pieceGlow(side))[side]).toBe(piece[side]);
				const { left, top } = pieceSvg(side).getBoundingClientRect();
				const hit = document.elementFromPoint(left + 5, top + 5);
				expect(frostLayer().contains(hit)).toBe(false);
			}
			expect(edgesOf(pieceBox("bottom"))).toEqual({
				top: 682,
				right: 1200,
				bottom: 800,
				left: 0,
			});
			const { blurred, stems } = piecePaths("bottom");
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
		for (const side of SIDES) {
			const { blurred, grainy } = piecePaths(side, second);
			const blur = referenced(getComputedStyle(blurred).filter);
			const grain = referenced(getComputedStyle(grainy).stroke);
			expect(second.contains(blur)).toBe(true);
			expect(second.contains(grain)).toBe(true);
		}
	});

	test("grows each edge's crystals in its own piece", () => {
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost();
		expectDrawn(edgesFor(1200, 800));
	});
	test("shows each piece its own part of the drawing", () => {
		stop = frost();
		const views = SIDES.map((side) => pieceSvg(side).getAttribute("viewBox"));
		expect(views).toEqual([
			"0 0 1200 90",
			"0 682 1200 118",
			"0 0 90 800",
			"1110 0 90 800",
		]);
		for (const side of SIDES) {
			const blur = referenced(
				getComputedStyle(piecePaths(side).blurred).filter,
			);
			const region = ["x", "y", "width", "height"]
				.map((name) => blur.getAttribute(name))
				.join(" ");
			expect(region).toBe(pieceSvg(side).getAttribute("viewBox"));
		}
	});
	test("draws for the whole screen when the window is smaller", () => {
		useScreen(1920, 1080);
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost();
		finishGrowth();
		expectDrawn(edgesFor(1920, 1080));
		expect(edgesOf(pieceBox("top"))).toEqual({
			top: 0,
			right: 1920,
			bottom: 90,
			left: 0,
		});
		expect(edgesOf(pieceBox("bottom"))).toEqual({
			top: 682,
			right: 1920,
			bottom: 800,
			left: 0,
		});
		expect(edgesOf(pieceBox("right"))).toEqual({
			top: -280,
			right: 1200,
			bottom: 800,
			left: 1110,
		});
		expect(pieceSvg("right").getAttribute("viewBox")).toBe("1830 0 90 1080");
	});
	test("draws for the window when it's bigger than the screen", () => {
		useScreen(1000, 700);
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost();
		expectDrawn(edgesFor(1200, 800));
	});
	test("fits a phone", async () => {
		await resizeTo(390, 844);
		useScreen(390, 844);
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost();
		expectDrawn(edgesFor(390, 844));
	});
	test("grows longer crystals in thicker pieces for a bigger size", () => {
		vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
		stop = frost({ size: 2 });
		finishGrowth();
		expectDrawn(edgesFor(1200, 800, 2));
		expect(pieceBox("top").getBoundingClientRect().height).toBe(160);
		expect(pieceBox("left").getBoundingClientRect().width).toBe(160);
		expect(pieceBox("bottom").getBoundingClientRect().height).toBe(216);
	});
	test("keeps the pieces thick enough for the whole glow at a small size", () => {
		stop = frost({ size: 0.5 });
		finishGrowth();
		expect(pieceBox("top").getBoundingClientRect().height).toBe(90);
		expect(pieceBox("bottom").getBoundingClientRect().height).toBe(118);
	});
	test("grows different crystals each time it starts", () => {
		const stopFirst = frost();
		const first = piecePaths("top").stems.getAttribute("d");
		stopFirst();
		stop = frost();
		expect(first).not.toBe("");
		expect(piecePaths("top").stems.getAttribute("d")).not.toBe(first);
	});

	test("creeps in from every edge over 5 seconds", () => {
		stop = frost();
		const effects = growthEffects();
		expect(effects).toHaveLength(8);
		for (const effect of effects) {
			expect(effect.getTiming()).toMatchObject({
				duration: 5000,
				easing: "ease-out",
			});
		}
	});
	test("uncovers the frost from each edge while the frost stays in place", () => {
		stop = frost();
		const growths = document.getAnimations();
		finishGrowth();
		const grown = SIDES.map((side) => edgesOf(pieceSvg(side)));
		for (const growth of growths) {
			growth.pause();
			growth.currentTime = 0;
		}
		expect(edgesOf(pieceBox("top")).bottom).toBe(0);
		expect(edgesOf(pieceBox("bottom")).top).toBe(800);
		expect(edgesOf(pieceBox("left")).right).toBe(0);
		expect(edgesOf(pieceBox("right")).left).toBe(1200);
		for (const growth of growths) {
			growth.currentTime = 2500;
		}
		for (const [index, side] of SIDES.entries()) {
			expect(edgesOf(pieceSvg(side))).toEqual(grown[index]);
		}
		expect(edgesOf(pieceBox("top")).bottom).toBeGreaterThan(0);
		expect(edgesOf(pieceBox("top")).bottom).toBeLessThan(90);
		expect(edgesOf(pieceBox("bottom")).top).toBeLessThan(800);
		expect(edgesOf(pieceBox("bottom")).top).toBeGreaterThan(682);
	});
	test("only moves things while growing, which the graphics card can do alone", () => {
		stop = frost();
		for (const effect of growthEffects()) {
			for (const frame of effect.getKeyframes()) {
				const animated = Object.keys(frame).filter(
					(name) =>
						!["offset", "computedOffset", "easing", "composite"].includes(name),
				);
				expect(animated).toEqual(["transform"]);
			}
		}
	});
	test("softens the inner edge of every piece", () => {
		stop = frost();
		for (const side of SIDES) {
			expect(getComputedStyle(pieceBox(side)).maskImage).toContain(
				"calc(100% - 20px)",
			);
		}
		expect(getComputedStyle(pieceBox("bottom")).maskImage).toContain("to top");
	});
	test("gives every piece its own layer, so a resize doesn't repaint it", () => {
		stop = frost();
		for (const side of SIDES) {
			expect(getComputedStyle(pieceBox(side)).willChange).toBe("transform");
		}
	});
	test("shows the whole frost at once under reduced motion", async () => {
		await commands.emulateReducedMotion("reduce");
		stop = frost();
		expect(document.getAnimations()).toHaveLength(0);
		expect(piecePaths("top").stems.getAttribute("d")).not.toBe("");
	});
	test("jumps to the end when reduced motion gets turned on", async () => {
		stop = frost();
		const growths = document.getAnimations();
		await switchReducedMotion("reduce");
		await vi.waitFor(() => {
			expect(growths.map((growth) => growth.playState)).toEqual(
				Array(8).fill("finished"),
			);
		});
		expect(document.getAnimations()).toHaveLength(0);
	});
	test("cancels the growth when stopped", () => {
		const stopFrost = frost();
		const growths = document.getAnimations();
		stopFrost();
		expect(growths.map((growth) => growth.playState)).toEqual(
			Array(8).fill("idle"),
		);
	});
	test("ignores reduced motion changes once stopped", async () => {
		stop = frost();
		stop();
		const finish = vi.spyOn(Animation.prototype, "finish");
		await switchReducedMotion("reduce");
		expect(finish).not.toHaveBeenCalled();
	});

	describe("when the window changes size", () => {
		test("keeps every piece on its edge while the window is dragged, without redrawing", async () => {
			useScreen(1920, 1080);
			stop = frost();
			finishGrowth();
			const draw = vi.spyOn(piecePaths("top").stems, "setAttribute");
			for (const [dragged, tall] of [
				[1100, 750],
				[900, 600],
			] as const) {
				await resizeTo(dragged, tall);
				expect(edgesOf(pieceBox("top")).top).toBe(0);
				expect(edgesOf(pieceBox("right")).right).toBe(dragged);
				expect(edgesOf(pieceBox("bottom")).bottom).toBe(tall);
				expect(edgesOf(pieceBox("left")).bottom).toBe(tall);
				expect(edgesOf(pieceBox("right")).bottom).toBe(tall);
			}
			expect(draw).not.toHaveBeenCalled();
		});
		test("redraws the same crystals for the new screen when a phone turns", async () => {
			await resizeTo(390, 844);
			useScreen(390, 844);
			vi.spyOn(Math, "random").mockReturnValueOnce(SEED_PICK);
			stop = frost();
			useScreen(844, 390);
			await resizeTo(844, 390);
			expectDrawn(edgesFor(844, 390));
		});
		test("draws for the window turned sideways when the screen size stays upright", async () => {
			await resizeTo(844, 390);
			useScreen(390, 844);
			vi.spyOn(Math, "random").mockReturnValue(SEED_PICK);
			stop = frost();
			expectDrawn(edgesFor(844, 390));
		});
		test("redraws the same crystals when the window gets taller than the screen", async () => {
			vi.spyOn(Math, "random").mockReturnValueOnce(SEED_PICK);
			stop = frost();
			await resizeTo(1200, 900);
			expectDrawn(edgesFor(1200, 900));
		});
		test("redraws the same crystals when the window grows past the screen", async () => {
			useScreen(1000, 700);
			await resizeTo(1000, 700);
			vi.spyOn(Math, "random").mockReturnValueOnce(SEED_PICK);
			stop = frost();
			await resizeTo(1200, 800);
			expectDrawn(edgesFor(1200, 800));
		});
		test("doesn't start the growth again", async () => {
			useScreen(1000, 700);
			await resizeTo(1000, 700);
			stop = frost();
			const animate = vi.spyOn(Element.prototype, "animate");
			const draw = vi.spyOn(piecePaths("top").stems, "setAttribute");
			await resizeTo(1200, 800);
			expect(draw).toHaveBeenCalled();
			expect(animate).not.toHaveBeenCalled();
		});
		test("stops watching the size once stopped", async () => {
			useScreen(1000, 700);
			await resizeTo(1000, 700);
			stop = frost();
			const draw = vi.spyOn(piecePaths("top").stems, "setAttribute");
			stop();
			useScreen(1920, 1080);
			await resizeTo(1200, 800);
			expect(draw).not.toHaveBeenCalled();
		});
	});
});
