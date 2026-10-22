/** Small line icons for the interface. Each is decorative; the text next to it carries the meaning. */
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const IconUpload = () => (
  <svg {...base}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);

export const IconOverview = () => (
  <svg {...base}>
    <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
    <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
  </svg>
);

export const IconThemes = () => (
  <svg {...base}>
    <path d="M4 6h10M4 12h16M4 18h7" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="14" cy="18" r="2" />
  </svg>
);

export const IconPlan = () => (
  <svg {...base}>
    <path d="m4.5 6.5 1.8 1.8 3-3.3M4.5 12.5l1.8 1.8 3-3.3M4.5 18.5l1.8 1.8 3-3.3" />
    <path d="M13 7h7M13 13h7M13 19h7" />
  </svg>
);

export const IconQuote = () => (
  <svg {...base}>
    <path d="M7 7h4v5a4 4 0 0 1-4 4M15 7h4v5a4 4 0 0 1-4 4" />
  </svg>
);

export const IconShield = () => (
  <svg {...base}>
    <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-2.5Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

export const IconBars = () => (
  <svg {...base}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </svg>
);

export const IconFile = () => (
  <svg {...base}>
    <path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5Z" />
    <path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
  </svg>
);

export const IconCheck = () => (
  <svg {...base}>
    <path d="m5 12.5 4.2 4.2L19 7" />
  </svg>
);

export const IconAlert = () => (
  <svg {...base}>
    <path d="M12 4 3 19.5h18L12 4Z" />
    <path d="M12 10v4.5M12 17.2v.1" />
  </svg>
);
