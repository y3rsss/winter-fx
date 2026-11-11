import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { watchReducedMotion } from "./motion.ts";

function waitForReducedMotion(): Promise<void> {
	const query = matchMedia("(prefers-reduced-motion: reduce)");
	return new Promise((resolve) => {
		query.addEventListener("change", () => resolve(), { once: true });
	});
}

describe("watchReducedMotion", () => {
	let controller: AbortController;
	let calls: boolean[];

	beforeEach(() => {
		controller = new AbortController();
		calls = [];
	});

	afterEach(async () => {
		controller.abort();
		await commands.emulateReducedMotion("no-preference");
	});

	test("tells the current setting right away", () => {
		watchReducedMotion((reduced) => calls.push(reduced), controller.signal);
		expect(calls).toEqual([false]);
	});
	test("tells when reduced motion gets turned on", async () => {
		watchReducedMotion((reduced) => calls.push(reduced), controller.signal);
		await commands.emulateReducedMotion("reduce");
		await vi.waitFor(() => {
			expect(calls).toEqual([false, true]);
		});
	});
	test("tells when it gets turned off again", async () => {
		await commands.emulateReducedMotion("reduce");
		watchReducedMotion((reduced) => calls.push(reduced), controller.signal);
		await commands.emulateReducedMotion("no-preference");
		await vi.waitFor(() => {
			expect(calls).toEqual([true, false]);
		});
	});
	test("stops telling once the signal aborts", async () => {
		watchReducedMotion((reduced) => calls.push(reduced), controller.signal);
		controller.abort();
		const changed = waitForReducedMotion();
		await commands.emulateReducedMotion("reduce");
		await changed;
		expect(calls).toEqual([false]);
	});
});
