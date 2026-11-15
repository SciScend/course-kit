// Back after a #link on the same page returns to the link.
// For a link to another page, the VitePress router saves the scroll position in the
// current history entry before it adds the new one, and Back scrolls there. For a
// #link on the same page it adds the entry without saving it (router.js, VitePress
// 1.6), so Back scrolls to the #section of the old address - or to the top of the
// page - not to the place of the link. So save the position before every new entry:
// on Back the router reads `scrollPosition` from the entry and scrolls there.
// `{ ...history.state }` keeps what the router or a course keeps in the entry.

const WRAPPED = Symbol('backKeepsPlace')

export function setupBackKeepsPlace() {
  if (typeof window === 'undefined' || history.pushState[WRAPPED]) return
  const push = history.pushState
  function pushState(...args) {
    try {
      history.replaceState({ ...history.state, scrollPosition: window.scrollY }, '')
    } catch { }
    return push.apply(this, args)
  }
  pushState[WRAPPED] = true
  history.pushState = pushState
}
