import { updateActiveBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { planningItem } from "../../components/planning-item.js";
import { emptyState } from "../../components/empty-state.js";
import { sortSchedule, formatShortDate } from "../../utils/format.js";
import { canEdit } from "../boards/board-model.js";
import { toggleForm, removeById } from "../../utils/dom.js";

export function renderSchedule(board) {
  const items = sortSchedule(board.schedule).map((item) =>
    planningItem({
      accent: "blue",
      columns: [
        { label: "Playing", value: item.activity, primary: true },
        { label: "Date", value: formatShortDate(item.date) },
        { label: "Time", value: `${item.start} - ${item.end}` },
        { label: "Status", value: "Planned", badge: "blue" }
      ],
      onDelete: () => updateActiveBoard((draft) => removeById(draft.schedule, item.id))
    })
  );
  elements.scheduleList.replaceChildren(...(items.length ? items : [emptyState("No game nights scheduled yet")]));
}

export function bindScheduleEvents() {
  elements.addTimeButton.addEventListener("click", () => toggleForm(elements.timeForm));

  elements.timeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    updateActiveBoard((board) => {
      board.schedule.push({
        id: crypto.randomUUID(),
        date: elements.timeDate.value,
        start: elements.timeStart.value,
        end: elements.timeEnd.value,
        activity: elements.timeActivity.value.trim()
      });
    });
    elements.timeForm.reset();
    elements.timeForm.classList.add("hidden");
  });
}
