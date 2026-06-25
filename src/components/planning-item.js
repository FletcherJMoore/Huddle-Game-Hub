import { canEdit } from "../features/boards/board-model.js";

// A generic table-style row used by the schedule list.
export function planningItem({ accent = "blue", columns, onDelete }) {
  const row = document.createElement("article");
  row.className = `planning-item accent-${accent}`;
  row.innerHTML = `
    <div class="row-cells"></div>
    <div class="item-actions"></div>
  `;

  const cells = row.querySelector(".row-cells");
  columns.forEach((column) => {
    const cell = document.createElement("div");
    cell.className = `board-cell${column.primary ? " primary-cell" : ""}`;
    cell.innerHTML = `<span></span><strong></strong>`;
    cell.querySelector("span").textContent = column.label;
    const value = cell.querySelector("strong");
    value.textContent = column.value;
    if (column.badge) {
      value.className = `status-chip ${column.badge}`;
    }
    cells.append(cell);
  });

  const actions = row.querySelector(".item-actions");
  if (canEdit() && onDelete) {
    const remove = document.createElement("button");
    remove.className = "icon-button delete-item";
    remove.type = "button";
    remove.title = "Delete";
    remove.setAttribute("aria-label", "Delete");
    remove.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>`;
    remove.addEventListener("click", onDelete);
    actions.append(remove);
  }

  return row;
}
