import { garland, type Stop, snow } from "../src/index.ts";

function byId(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`the demo page has no #${id}`);
	}
	return element;
}

const snowButton = byId("snow");
const garlandButton = byId("garland");
const darkButton = byId("dark");
const sampleButton = byId("sample");
const clicks = byId("clicks");

let stopSnow: Stop | undefined;
let stopGarland: Stop | undefined;
let dark = false;
let clickCount = 0;

function toggleSnow(): void {
	if (stopSnow === undefined) {
		stopSnow = snow({ color: "light-dark(#7f9cc0, #ffffff)" });
	} else {
		stopSnow();
		stopSnow = undefined;
	}
	snowButton.setAttribute("aria-pressed", String(stopSnow !== undefined));
}

function toggleGarland(): void {
	if (stopGarland === undefined) {
		stopGarland = garland();
	} else {
		stopGarland();
		stopGarland = undefined;
	}
	garlandButton.setAttribute("aria-pressed", String(stopGarland !== undefined));
}

function toggleDark(): void {
	dark = !dark;
	document.documentElement.style.colorScheme = dark ? "dark" : "light";
	darkButton.setAttribute("aria-pressed", String(dark));
}

snowButton.addEventListener("click", toggleSnow);
garlandButton.addEventListener("click", toggleGarland);
darkButton.addEventListener("click", toggleDark);
sampleButton.addEventListener("click", () => {
	clickCount += 1;
	clicks.textContent = `Clicks: ${clickCount}`;
});

toggleSnow();
toggleGarland();
