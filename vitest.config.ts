import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

type ReducedMotion = "reduce" | "no-preference";

declare module "vitest/browser" {
	interface BrowserCommands {
		emulateReducedMotion: (value: ReducedMotion) => Promise<void>;
	}
}

const emulateReducedMotion: BrowserCommand<[value: ReducedMotion]> = async (
	{ page },
	value,
) => {
	await page.emulateMedia({ reducedMotion: value });
};

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "node",
					include: ["src/**/*.test.ts"],
					exclude: ["src/**/*.browser.test.ts"],
				},
			},
			{
				test: {
					name: "browser",
					include: ["src/**/*.browser.test.ts"],
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: "chromium" }],
						commands: { emulateReducedMotion },
					},
				},
			},
		],
	},
});
