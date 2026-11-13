const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function svgElement(
	tag: string,
	attributes: Record<string, string | number>,
): SVGElement {
	const element = document.createElementNS(SVG_NAMESPACE, tag);
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, String(value));
	}
	return element;
}

let lastId = 0;

export function uniqueId(name: string): string {
	lastId += 1;
	return `winter-fx-${name}-${lastId}`;
}
