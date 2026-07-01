// Initial local state. New users start with no boards and are prompted to
// create their first one; boards are created explicitly or arrive via invites.

export const defaultState = {
  activeBoardId: null,
  boards: []
};
