// The mark: a sprout that is also a child with both arms up. Same drawing as public/favicon.svg.
export function LogoMark({ className = 'size-10' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" className="logo-tile" />
      <g className="fill-sprout-500">
        <path d="M27 38Q13.5 38.5 13 25 26.5 24.5 27 38Z" />
        <path d="M27 38Q48.6 33.8 51 12 29.4 16.2 27 38Z" />
      </g>
      <path d="M27 37V52" className="stroke-sprout-500" strokeWidth="5" strokeLinecap="round" />
      <circle cx="25" cy="19.5" r="5" className="fill-sun-500" />
    </svg>
  )
}

// Mark plus wordmark. Add logo-lg for the large size; it turns white on a navy surface by itself.
export default function Logo({ className = '' }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark className="" />
      <span translate="no">GrowKid</span>
    </span>
  )
}
