import { afterEach, describe, expect, test } from "vitest";
import { assertBrowser, createOverlay } from "./overlay.ts";

describe("assertBrowser", () => {
	test("does nothing on a loaded page", () => {
		expect(() => assertBrowser("snow")).not.toThrow();
	});
	test("throws when the page has no body yet", () => {
		const body = document.body;
		body.remove();
		try {
			expect(() => assertBrowser("snow")).toThrow(
				"winter-fx: snow() needs document.body, call it after the page has loaded",
			);
		} finally {
			document.documentElement.append(body);
		}
	});
});

describe("createOverlay", () => {
	let overlay: HTMLDivElement | undefined;

	afterEach(() => {
		overlay?.remove();
	});

	test("goes after everything else on the page", () => {
		const content = document.createElement("p");
		document.body.append(content);
		try {
			overlay = createOverlay(42);
			expect(document.body.lastElementChild).toBe(overlay);
		} finally {
			content.remove();
		}
	});
	test("stays in place while the page scrolls", () => {
		overlay = createOverlay(42);
		expect(overlay.style.position).toBe("fixed");
	});
	test("lets clicks through to the page", () => {
		overlay = createOverlay(42);
		expect(overlay.style.pointerEvents).toBe("none");
	});
	test("is hidden from screen readers", () => {
		overlay = createOverlay(42);
		expect(overlay.getAttribute("aria-hidden")).toBe("true");
	});
	test("uses the z-index it was given", () => {
		overlay = createOverlay(42);
		expect(overlay.style.zIndex).toBe("42");
	});
	test("covers the whole window", () => {
		overlay = createOverlay(42);
		const box = overlay.getBoundingClientRect();
		expect(box.x).toBe(0);
		expect(box.y).toBe(0);
		expect(box.width).toBe(innerWidth);
		expect(box.height).toBe(innerHeight);
	});
});
