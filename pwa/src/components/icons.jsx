/**
 * Small inline SVG icons. They take the colour of the surrounding text
 * (stroke="currentColor") and are hidden from screen readers, because the text
 * or aria-label next to them already says the same thing.
 */
function Icon({ children, size = 24 }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
    <path d="M4.5 12.5l5 5L19.5 7" />
  </Icon>
);

export const WarnIcon = () => (
  <Icon>
    <path d="M12 3.5L2.8 19.5h18.4L12 3.5z" />
    <path d="M12 10v4M12 17v.01" />
  </Icon>
);

export const WaitIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 3.5" />
  </Icon>
);

export const CameraIcon = () => (
  <Icon>
    <path d="M3 8.5h3.5l1.5-2.5h8l1.5 2.5H21V19H3z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Icon>
);

export const ImageIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M3 17l5-4.5 4 3.5 3-2.5 6 4.5" />
  </Icon>
);

export const RetakeIcon = () => (
  <Icon>
    <path d="M4 12a8 8 0 1 0 2.6-5.9" />
    <path d="M4 4v4.5h4.5" />
  </Icon>
);

export const MenuIcon = () => (
  <Icon>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

/** Viewfinder corners: the "Scan" destination. */
export const ScanIcon = () => (
  <Icon>
    <path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4" />
    <circle cx="12" cy="12" r="2.5" />
  </Icon>
);

export const HistoryIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 17v.01" />
  </Icon>
);

export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
  </Icon>
);

/** A phone with an arrow: "install to this device". */
export const InstallIcon = () => (
  <Icon>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M12 8v6M9.5 11.5L12 14l2.5-2.5" />
  </Icon>
);

export const TrashIcon = () => (
  <Icon>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5" />
  </Icon>
);

export const ShareIcon = () => (
  <Icon>
    <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6.5h14V13" />
  </Icon>
);

export const ChevronIcon = () => (
  <Icon>
    <path d="M9.5 6l6 6-6 6" />
  </Icon>
);

export const ArrowLeftIcon = () => (
  <Icon>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3l7.5 3v5.5c0 4.5-3 7.8-7.5 9.5-4.5-1.7-7.5-5-7.5-9.5V6L12 3z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </Icon>
);
