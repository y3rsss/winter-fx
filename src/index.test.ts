import { expect, test } from "vitest";

// the first import compiles every module, which can pass 5 s while the test browsers start
test("can be imported outside a browser", { timeout: 20_000 }, async () => {
	const winterFx = await import("./index.ts");
	expect(typeof winterFx.snow).toBe("function");
	expect(typeof winterFx.garland).toBe("function");
	expect(typeof winterFx.frost).toBe("function");
});

test.each(["snow", "garland", "frost"] as const)(
	"%s() says it must run in a browser when called outside one",
	async (name) => {
		const winterFx = await import("./index.ts");
		expect(() => winterFx[name]()).toThrow(
			`winter-fx: ${name}() must run in a browser`,
		);
	},
);
