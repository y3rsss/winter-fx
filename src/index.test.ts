import { expect, test } from "vitest";

test("can be imported outside a browser", async () => {
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
