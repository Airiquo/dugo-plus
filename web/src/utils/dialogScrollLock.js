const locks = new WeakMap();

/** Keep body scrolling locked until every nested native dialog has released it. */
export function lockDialogScroll(body = document.body) {
  const lock = locks.get(body) || { count: 0, previous: body.style.overflow };
  lock.count++;
  locks.set(body, lock);
  body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count--;
    if (!lock.count) {
      body.style.overflow = lock.previous;
      locks.delete(body);
    }
  };
}
