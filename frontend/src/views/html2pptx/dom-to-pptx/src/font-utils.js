export function getUsedFontFamilies(targets) {
  const families = new Set();
  targets.forEach((target) => {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return;
    [root, ...Array.from(root.querySelectorAll('*'))].forEach((element) => {
      const family = window.getComputedStyle(element).fontFamily;
      if (family) families.add(family);
    });
  });
  return Array.from(families);
}

export async function getAutoDetectedFonts() {
  return [];
}
