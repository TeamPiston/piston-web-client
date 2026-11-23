import assert from "node:assert/strict";

/** One fake same-origin lock manager can be shared by independent VM tabs. */
export function createAuthLocks() {
  let held = false;
  const queue = [];
  const next = () => {
    if (held || queue.length === 0) return;
    held = true;
    queue.shift()();
  };

  return {
    get pending() { return queue.length; },
    request(name, options, callback) {
      assert.equal(name, "piston-auth-storage");
      assert.equal(options.mode, "exclusive");
      return new Promise((resolve, reject) => {
        queue.push(() => {
          const release = () => {
            held = false;
            next();
          };
          try {
            options.signal?.throwIfAborted();
            Promise.resolve(callback()).then(resolve, reject).finally(release);
          } catch (error) {
            reject(error);
            release();
          }
        });
        next();
      });
    },
  };
}
