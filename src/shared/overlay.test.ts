import { expect, test } from "vitest";
import { assertBrowser } from "./overlay.ts";

test("assertBrowser throws outside a browser", () => {
	expect(() => assertBrowser("snow")).toThrow(
		"winter-fx: snow() must run in a browser",
	);
});
