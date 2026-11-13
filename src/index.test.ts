import { expect, test } from "vitest";

test("can be imported outside a browser", async () => {
	const winterFx = await import("./index.ts");
	expect(typeof winterFx.snow).toBe("function");
});
