export function getOwnerWindow(node) {
  return node?.ownerDocument?.defaultView || window;
}

export function getComputedStyleForNode(node, pseudoElement) {
  return getOwnerWindow(node).getComputedStyle(node, pseudoElement);
}
