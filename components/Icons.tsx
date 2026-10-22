import type { FactorIcon } from "@/lib/types";

export type IconName =
  | FactorIcon
  | "busy"
  | "info"
  | "check" | "cross" | "question" | "flag" | "pdf" | "reply" | "whatsapp";

const PATHS: Record<IconName, React.ReactNode> = {
  capacity: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5M15 14.2c2.6-.3 4.8 1.2 5.5 4.6" />
    </>
  ),
  closed: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  hours: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  bill: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  reservation: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  dish: (
    <>
      <path d="M7 3v8a2 2 0 0 0 2 2v8M7 3v6M11 3v6M16 3c-2 2-2.5 5-2.5 8h2.5v10" />
    </>
  ),
  tables: (
    <>
      <rect x="3.5" y="5" width="7" height="6" rx="1.2" />
      <rect x="13.5" y="5" width="7" height="6" rx="1.2" />
      <rect x="3.5" y="14" width="7" height="6" rx="1.2" />
      <rect x="13.5" y="14" width="7" height="6" rx="1.2" />
    </>
  ),
  burst: <path d="M13 2 5 13h6l-1 9 8-11h-6z" />,
  similar: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  wording: <path d="M5 17c0-4 1-7 4-9M13 17c0-4 1-7 4-9M5 17h4v-4M13 17h4v-4" />,
  detail: (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <path d="M4 4l16 16" />
    </>
  ),
  trust: (
    <>
      <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  busy: <path d="M5 20V12M10 20V5M15 20v-9M20 20V8" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  question: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
    </>
  ),
  flag: <path d="M6 21V4M6 5h11l-2 4 2 4H6" />,
  pdf: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 14h5M10 17h5" />
    </>
  ),
  reply: <path d="M20 6H4v10h4v4l5-4h7z" />,
  whatsapp: (
    <>
      <path d="M4 20l1.4-4.2A8 8 0 1 1 8.3 18.7z" />
      <path d="M9 9.5c.3 2.4 2.600 4.700 5.500 5.500l1.300-1.300-2-1-.9.8c-1-.4-1.900-1.300-2.300-2.300l.8-.9-1-2z" />
    </>
  ),
};

export default function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "icon"}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
