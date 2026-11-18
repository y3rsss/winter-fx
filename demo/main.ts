import { frost, garland, type Stop, snow } from "../src/index.ts";

function byId(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`the demo page has no #${id}`);
	}
	return element;
}

function effectToggle(button: HTMLElement, start: () => Stop): () => void {
	let stop: Stop | undefined;
	return () => {
		if (stop === undefined) {
			stop = start();
		} else {
			stop();
			stop = undefined;
		}
		button.setAttribute("aria-pressed", String(stop !== undefined));
	};
}

const snowButton = byId("snow");
const garlandButton = byId("garland");
const frostButton = byId("frost");
const darkButton = byId("dark");
const sampleButton = byId("sample");
const clicks = byId("clicks");

const toggleSnow = effectToggle(snowButton, () =>
	snow({ color: "light-dark(#7f9cc0, #ffffff)" }),
);
const toggleGarland = effectToggle(garlandButton, () => garland());
const toggleFrost = effectToggle(frostButton, () => frost());

let dark = false;
let clickCount = 0;

function toggleDark(): void {
	dark = !dark;
	document.documentElement.style.colorScheme = dark ? "dark" : "light";
	darkButton.setAttribute("aria-pressed", String(dark));
}

snowButton.addEventListener("click", toggleSnow);
garlandButton.addEventListener("click", toggleGarland);
frostButton.addEventListener("click", toggleFrost);
darkButton.addEventListener("click", toggleDark);
sampleButton.addEventListener("click", () => {
	clickCount += 1;
	clicks.textContent = `Clicks: ${clickCount}`;
});

toggleSnow();
toggleGarland();
toggleFrost();
