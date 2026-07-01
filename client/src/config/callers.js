// Fixed list of callers. Edit this list to add/remove people.
// - id:   stable identifier, also the URL path (must be unique, lowercase)
// - name: display name shown in the UI
// - url:  the personal link a person opens to "become" this caller
//
// A browser figures out which caller it is from the URL path:
//   https://yoursite.com/alice  ->  this browser is "alice".
export const callers = [
  { id: "EGH_UI", name: "EGH_UI", url: "/egh_ui" },
  { id: "pudu_1", name: "pudu_1", url: "/pudu_1" },
  { id: "pudu_2", name: "pudu_2", url: "/pudu_2" },
];

// Work out which caller this browser is, based on the URL path.
// "/alice" or "/alice/" -> the matching caller object, or undefined.
export const getCurrentUser = () => {
  const id = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  return callers.find((caller) => caller.id.toLowerCase() === id);
};

// Everyone the given user is allowed to call: all other callers.
export const getCallableUsers = (currentId) =>
  callers.filter((caller) => caller.id !== currentId);

// Work out who this browser should call, based on the "?call=" query param.
//   https://yoursite.com/pudu_1?call=pudu_2  ->  pudu_1 wants to call pudu_2.
// Returns the target caller id (matched case-insensitively against a known
// caller), or "" if the param is missing/unknown/points at yourself.
export const getCallTarget = (currentId) => {
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get("call") || "").trim().toLowerCase();
  if (!requested) return "";
  const target = callers.find(
    (caller) => caller.id.toLowerCase() === requested
  );
  if (!target || target.id === currentId) return "";
  return target.id;
};
