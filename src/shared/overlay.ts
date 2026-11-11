export function assertBrowser(effect: string): void {
	if (typeof document === "undefined") {
		throw new Error(`winter-fx: ${effect}() must run in a browser`);
	}

	if (document.body === null) {
		throw new Error(
			`winter-fx: ${effect}() needs document.body, call it after the page has loaded`,
		);
	}
}

export function createOverlay(zIndex: number): HTMLDivElement {
	const overlay = document.createElement("div");

	overlay.style.position = "fixed";
	overlay.style.inset = "0";
	overlay.style.pointerEvents = "none";
	overlay.style.zIndex = String(zIndex);
	overlay.setAttribute("aria-hidden", "true");

	document.body.append(overlay);

	return overlay;
}
