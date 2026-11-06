/* Registration points for later reversing lower→upper calls. */
const hooks = new Map();

export function register(name, fn) {
  if (!name || typeof fn !== "function") return function unregister() {};
  const list = hooks.get(name) || [];
  list.push(fn);
  hooks.set(name, list);
  return function unregister() {
    const next = (hooks.get(name) || []).filter((item) => item !== fn);
    hooks.set(name, next);
  };
}

export function emit(name) {
  const args = Array.prototype.slice.call(arguments, 1);
  const list = hooks.get(name) || [];
  for (let i = 0; i < list.length; i += 1) list[i].apply(null, args);
}

export function call(name) {
  const args = Array.prototype.slice.call(arguments, 1);
  const list = hooks.get(name) || [];
  var result;
  for (let i = 0; i < list.length; i += 1) result = list[i].apply(null, args);
  return result;
}

export function clear(name) {
  if (name == null) hooks.clear();
  else hooks.delete(name);
}
