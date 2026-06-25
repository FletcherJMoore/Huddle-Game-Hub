// Small DOM helpers shared across features.

export function toggleForm(form) {
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) {
    form.querySelector("input, select")?.focus();
  }
}

export function removeById(collection, id) {
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) collection.splice(index, 1);
}
