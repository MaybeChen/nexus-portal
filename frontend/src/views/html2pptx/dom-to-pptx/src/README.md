# dom-to-pptx local source

This directory vendors the route-local `dom-to-pptx` source entry used by the
HTML2PPTX page. It intentionally exposes the same public entrypoint requested by
the upstream project (`index.js` → `exportToPptx`) so the feature no longer loads
a remote bundled script at runtime.

Upstream source reference: https://github.com/atharva9167j/dom-to-pptx/tree/master/src
