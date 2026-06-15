const TAILWIND_CDN_WARNING = 'cdn.tailwindcss.com should not be used in production';

export function isIgnoredIframeWarning(args) {
  return Array.from(args || []).some((value) =>
    String(value || '').includes(TAILWIND_CDN_WARNING)
  );
}

export function injectIframeWarningFilter(html) {
  const filterScript = `<script data-html2pptx-warning-filter>
    (() => {
      const originalWarn = console.warn.bind(console);
      console.warn = (...args) => {
        const ignored = args.some((value) =>
          String(value || '').includes(${JSON.stringify(TAILWIND_CDN_WARNING)})
        );
        if (!ignored) originalWarn(...args);
      };
    })();
  </script>`;

  const source = String(html || '');
  if (/<head(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<head(\s[^>]*)?>/i, (headTag) => `${headTag}${filterScript}`);
  }
  return `${filterScript}${source}`;
}
