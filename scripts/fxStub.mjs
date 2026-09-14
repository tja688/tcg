/** Silent Game.fx adapter for Node characterization. Records method names only. */
export function silentFx() {
  const calls = [];
  return new Proxy({ calls }, {
    get(target, prop) {
      if (prop === 'calls') return target.calls;
      if (prop === 'hud') return null;
      return (..._args) => {
        target.calls.push(prop);
      };
    },
  });
}
