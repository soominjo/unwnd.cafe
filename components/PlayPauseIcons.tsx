// The icons on the Pause and Play buttons of the home page's moving strips: the café photos and
// the reviews marquee.

export function PauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <rect x="1" width="3" height="10" />
      <rect x="6" width="3" height="10" />
    </svg>
  )
}

export function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M1 0l9 5-9 5z" />
    </svg>
  )
}
