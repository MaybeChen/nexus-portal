import { elementToSvgData } from './utils.js';

export function getProcessedImage(element) {
  const rect = element.getBoundingClientRect();
  return elementToSvgData(element, rect.width || 1280, rect.height || 720);
}
