import { elements } from "../state/dom.js";

export function emptyState(text) {
  const node = elements.emptyTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector("p").textContent = text;
  return node;
}
