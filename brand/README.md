# TheYep brand

Logo sources. The product does not load a display font: letters in the `*-outlined.svg` files are paths, and the interface stays on Nunito. Luckiest Guy (the face those paths came from) is Apache 2.0 — see [LICENSE-LuckiestGuy.txt](LICENSE-LuckiestGuy.txt). Do not add the font file to the app.

`*-editable.svg` files keep live text. They need Luckiest Guy installed (it is not in this repo) or the words fall back to another face. Use the outlined files in the product, in Figma when the font is not available, and anywhere the SVG has to render on its own.

| File                                       | When to use it                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `theyep-logo-burst-bold-outlined.svg`      | Main color mark. Sharp balloon, blue “The”, pink “YEP”. Light backgrounds, large sizes (share image, posters).                   |
| `theyep-logo-burst-soft-outlined.svg`      | Same wordmark, rounder balloon. Light backgrounds when the bold burst is too loud, and at small sizes. The header uses this one. |
| `theyep-logo-dark-burst-bold-outlined.svg` | Bold mark with a white halo and black keyline, drawn for `#212121`.                                                              |
| `theyep-logo-dark-burst-soft-outlined.svg` | Soft mark with the same halo, for `#212121`. The dark header uses this one.                                                      |
| `theyep-logo-mono-black-outlined.svg`      | One black ink, transparent ground. Print, stamps, single-color.                                                                  |
| `theyep-logo-mono-white-outlined.svg`      | One white ink, transparent ground. Photos and dark fields when the color mark is not wanted.                                     |
| `theyep-logo-outline-outlined.svg`         | Strokes only, no fills. Light backgrounds.                                                                                       |
| `theyep-icon.svg`                          | Y icon: balloon plus a single Y. Outlined. App icon master from 32px up.                                                         |
| `theyep-icon-16.svg`                       | Simplified Y icon. Use at 16px, where the full icon’s points close up.                                                           |
| `theyep-icon-editable.svg`                 | Y icon with live text. Needs Luckiest Guy. Not used in the app.                                                                  |
| `theyep-logo-burst-bold-editable.svg`      | Live-text bold mark. Needs Luckiest Guy.                                                                                         |
| `theyep-logo-burst-soft-editable.svg`      | Live-text soft mark. Needs Luckiest Guy.                                                                                         |
| `theyep-logo-dark-burst-bold-editable.svg` | Live-text dark bold mark. Needs Luckiest Guy.                                                                                    |
| `theyep-logo-dark-burst-soft-editable.svg` | Live-text dark soft mark. Needs Luckiest Guy.                                                                                    |
| `theyep-logo-mono-black-editable.svg`      | Live-text mono black. Needs Luckiest Guy.                                                                                        |
| `theyep-logo-mono-white-editable.svg`      | Live-text mono white. Needs Luckiest Guy.                                                                                        |
| `theyep-logo-outline-editable.svg`         | Live-text outline. Needs Luckiest Guy.                                                                                           |
| `LICENSE-LuckiestGuy.txt`                  | Apache License 2.0 for Luckiest Guy. Copyright 2010 Brian J. Bonislawsky DBA Astigmatic (AOETI).                                 |

Colors: pink `#F06292`, blue `#42A5F5`, yellow `#FFD54F`, black `#000000`, white halo `#FFFFFF`. `#212121` is the dark ground, not an ink.

The header serves copies of the soft outlined files at `public/logo-burst-soft.svg` and `public/logo-dark-burst-soft.svg`. Raster icons and `public/og.png` are exports, not sources.
