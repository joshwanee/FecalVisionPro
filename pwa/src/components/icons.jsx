/**
 * Small inline SVG icons. They inherit the surrounding text colour
 * (stroke="currentColor") and are hidden from screen readers because the
 * text next to them already says the same thing.
 */
function Icon({ children }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const CheckIcon = () => (
  <Icon>
    <path d="M4 12.5l5 5L20 6.5" />
  </Icon>
);

export const WarnIcon = () => (
  <Icon>
    <path d="M12 3L2.5 20h19L12 3z" />
    <path d="M12 10v4.5M12 17.5v.01" />
  </Icon>
);

export const WaitIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 4" />
  </Icon>
);

export const CameraIcon = () => (
  <Icon>
    <path d="M3 8h4l2-3h6l2 3h4v12H3z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Icon>
);

export const ImageIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M3 16l5-5 4 4 3-3 6 6" />
  </Icon>
);

export const RetakeIcon = () => (
  <Icon>
    <path d="M4 12a8 8 0 1 0 3-6.2" />
    <path d="M4 3v5h5" />
  </Icon>
);
