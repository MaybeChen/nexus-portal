# dom-to-pptx local source

This directory is the route-local vendor area for the `dom-to-pptx` `src` tree
used by the HTML2PPTX page. It mirrors the upstream source layout so this route
can import `src/index.js` and call `exportToPptx` directly without loading a
remote bundle at runtime.

Upstream source reference: https://github.com/atharva9167j/dom-to-pptx/tree/master/src

Copied source paths represented here:

- `index.js`
- `font-embedder.js`
- `font-utils.js`
- `image-processor.js`
- `pptx-normalizer.js`
- `utils.js`
- `__tests__/`
