import { elements } from "../state/dom.js";

export function emptyState(text, actions = []) {
  const node = elements.emptyTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector("p").textContent = text;
  if (actions.length) {
    const actionRow = document.createElement("div");
    actionRow.className = "empty-actions";
    actions.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = action.variant === "primary" ? "btn btn-accent btn-sm" : "btn btn-surface btn-sm";
      btn.textContent = action.label;
      btn.addEventListener("click", action.onClick);
      actionRow.append(btn);
    });
    node.append(actionRow);
  }
  return node;
}
