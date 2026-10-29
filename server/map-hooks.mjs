// Module resolve hook: a shared module loaded for one map (`office-world.js?map=studio`) loads its own shared
// dependencies for that same map, so one server process can hold one copy of the map geometry per map.
export function addMap(specifier, context, result) {
  const parent = context.parentURL ? new URL(context.parentURL) : null;
  const map = parent?.searchParams.get('map');
  if (map && specifier.startsWith('.') && result.url.startsWith('file:') && result.url.includes('/shared/') && !result.url.includes('?')) return { ...result, url: `${result.url}?map=${map}` };
  return result;
}
export function resolveSync(specifier, context, nextResolve) { return addMap(specifier, context, nextResolve(specifier, context)); }
export async function resolve(specifier, context, nextResolve) { return addMap(specifier, context, await nextResolve(specifier, context)); }
