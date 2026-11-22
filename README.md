# winter-fx

Falling snow, a twinkling garland and frost on the screen edges, for any web page. Each effect is one function call, works with any framework, and is 1.5 to 3 kB minified and compressed. No dependencies.

## Install

```sh
npm install winter-fx
```

## Quick start

```js
import { snow, garland, frost } from "winter-fx";

const stopSnow = snow();
const stopGarland = garland();
const stopFrost = frost();

// later, to remove the snow and everything it added
stopSnow();
```

Every effect returns a function that removes it. Calling that function again does nothing. Calling an effect twice adds two separate layers, each with its own stop function.

The effects sit over the page in a fixed layer. Clicks go through to the page underneath, and screen readers skip them.

## Effects

All settings are optional. Every effect also takes `zIndex`, any integer, which defaults to `9999`.

### snow

Snowflakes falling over the page, in three depth layers.

```js
snow({ color: "#ffffff", amount: 2, speed: 0.5 });
```

| Setting  | Default                          | Valid values                                                           |
| -------- | -------------------------------- | ---------------------------------------------------------------------- |
| `color`  | `"light-dark(#7f9cc0, #ffffff)"` | any CSS color                                                          |
| `amount` | `1`                              | a number greater than 0 and at most 3. Multiplies the number of flakes |
| `speed`  | `1`                              | a number greater than 0 and at most 5. Multiplies the falling speed    |

### garland

A string of lights across the top of the page. Each bulb twinkles on its own timing.

```js
garland({ colors: ["#ff4d4d", "#ffcc33"] });
```

| Setting  | Default                                        | Valid values                                             |
| -------- | ---------------------------------------------- | -------------------------------------------------------- |
| `colors` | `["#ff4d4d", "#ffcc33", "#4cd964", "#4da6ff"]` | a list of at least one CSS color. Bulbs cycle through it |

### frost

Ice crystals that grow in from the edges of the screen and leave the middle clear.

```js
frost({ size: 1.5 });
```

| Setting | Default                          | Valid values                                                                    |
| ------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `color` | `"light-dark(#6f93bd, #e4efff)"` | any CSS color                                                                   |
| `size`  | `1`                              | a number greater than 0 and at most 2. Multiplies how far the crystals reach in |

### Colors

Colors can be any CSS color, including variables like `"var(--brand)"`. The effects follow changes to them right away.

The default colors use `light-dark()`, which picks the light or dark value from the page's `color-scheme`. A dark site that doesn't set `color-scheme: dark` gets the light values, so set it or pass your own color.

## Wrong settings

A bad setting throws as soon as the effect is called, with a message that names the effect, the setting and the value it got:

```text
winter-fx: snow() setting "amount" must be a number greater than 0 and at most 3, got -1
```

A setting of the wrong type, or one the effect doesn't know, throws a `TypeError`. A value out of range throws a `RangeError`. A setting left out, `undefined` or `null` gets its default.

## Frameworks and server rendering

Importing winter-fx never touches the page, so it's safe in server-rendered apps like Next.js, Nuxt and Astro. Call the effects only in the browser, after the page has loaded. Called on the server, they throw.

Start an effect when your component mounts, and call its stop function when it unmounts. In React, the stop function is the effect's cleanup:

```jsx
import { useEffect } from "react";
import { snow } from "winter-fx";

export function Snow() {
	useEffect(() => snow(), []);
	return null;
}
```

## Script tag

Sites without a build step can load winter-fx from a CDN:

```html
<script type="module">
  import { snow } from "https://cdn.jsdelivr.net/npm/winter-fx@0.1/+esm";
  snow();
</script>
```

## Reduced motion

Visitors can ask their system for less motion. The effects follow that setting, and change while the page is open if it changes. No setting can turn this off.

| Effect  | With reduced motion on                                   |
| ------- | -------------------------------------------------------- |
| snow    | Shows nothing, and comes back when the setting turns off |
| garland | Bulbs stay lit without twinkling                         |
| frost   | Appears at once, without growing in                      |

## Browser support

Chrome and Edge 123, Firefox 120 and Safari 17.5, and later versions. These are the first versions with `light-dark()`, which the default colors use.

## License

MIT
