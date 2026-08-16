import type { SVGProps } from "react";

/**
 * Single source of truth for iconography. Every glyph in the panel is an
 * inline SVG from this map — the project uses no emoji and no icon fonts.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (props: IconProps) => ({
  width: props.size ?? 20,
  height: props.size ?? 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

const Seg = ({ d }: { d: string }) => (
  <>
    {d.split("|").map((seg, i) => (
      <path key={i} d={seg} />
    ))}
  </>
);

const path = (d: string) => {
  const C = (props: IconProps) => (
    <svg {...base(props)}>
      {d.split("|").map((seg, i) => (
        <path key={i} d={seg} />
      ))}
    </svg>
  );
  return C;
};

const raw = (children: React.ReactNode) => {
  const C = (props: IconProps) => <svg {...base(props)}>{children}</svg>;
  return C;
};

/**
 * The same shape, inked in rather than drawn.
 *
 * Every other glyph here is a 1.7px stroke, which is what makes the set look
 * like one set. A rating is the one place that does not work: four out of five
 * has to be legible as four, and two colours of the same outline is a
 * difference the eye has to go looking for. So exactly one glyph gets a solid
 * twin — not a licence for a solid variant of everything.
 */
const filled = (d: string) => {
  const C = (props: IconProps) => (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d={d} />
    </svg>
  );
  return C;
};

export const Icons = {
  // --- Navigation -------------------------------------------------------
  dashboard: raw(
    <>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </>
  ),
  cart: raw(
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <Seg d="M2 3h2.2l2.3 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H5.5" />
    </>
  ),
  list: path("M8 6h13|M8 12h13|M8 18h13|M3.5 6h.01|M3.5 12h.01|M3.5 18h.01"),
  wallet: raw(
    <>
      <Seg d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
      <rect x="3" y="8" width="18" height="12" rx="2.5" />
      <Seg d="M16 13h2.5" />
    </>
  ),
  ticket: raw(
    <>
      <Seg d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3.5a2.5 2.5 0 0 0 0-5z" />
      <Seg d="M12 8v1.5|M12 14.5V16" />
    </>
  ),
  user: raw(
    <>
      <circle cx="12" cy="8" r="3.5" />
      <Seg d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  users: raw(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <Seg d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <Seg d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  settings: raw(
    <>
      <circle cx="12" cy="12" r="3" />
      <Seg d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9v.03A1.7 1.7 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  logout: path("M15 17l5-5-5-5|M20 12H9|M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"),
  menu: path("M3 6h18|M3 12h18|M3 18h18"),
  close: path("M18 6 6 18|M6 6l12 12"),
  chevronDown: path("m6 9 6 6 6-6"),
  chevronRight: path("m9 6 6 6-6 6"),
  chevronLeft: path("m15 6-6 6 6 6"),
  arrowRight: path("M5 12h14|m13 6 6 6-6 6"),
  arrowLeft: path("M19 12H5|m11 18-6-6 6-6"),
  arrowUpRight: path("M7 17 17 7|M9 7h8v8"),
  arrowUp: path("M12 19V5|m5 12 7-7 7 7"),
  arrowDown: path("M12 5v14|m19 12-7 7-7-7"),
  external: path("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6|M15 3h6v6|M10 14 21 3"),

  // --- Status / feedback ------------------------------------------------
  check: path("m20 6-11 11-5-5"),
  checkCircle: raw(
    <>
      <circle cx="12" cy="12" r="9" />
      <Seg d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  alert: raw(
    <>
      <Seg d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <Seg d="M12 9v4|M12 17h.01" />
    </>
  ),
  info: raw(
    <>
      <circle cx="12" cy="12" r="9" />
      <Seg d="M12 16v-4|M12 8h.01" />
    </>
  ),
  clock: raw(
    <>
      <circle cx="12" cy="12" r="9" />
      <Seg d="M12 7v5l3.2 1.9" />
    </>
  ),
  spinner: raw(
    <>
      <Seg d="M12 3a9 9 0 1 0 9 9" />
    </>
  ),

  // --- Actions ----------------------------------------------------------
  plus: path("M12 5v14|M5 12h14"),
  minus: path("M5 12h14"),
  search: raw(
    <>
      <circle cx="11" cy="11" r="7" />
      <Seg d="m20 20-3.5-3.5" />
    </>
  ),
  filter: path("M3 5h18|M6.5 12h11|M10 19h4"),
  refresh: path("M21 12a9 9 0 1 1-2.6-6.4|M21 4v5h-5"),
  // Distinct from refresh on purpose: reorder and refill sit side by side on
  // the same row, and two actions drawn with one glyph is one action.
  repeat: path("M17 2l4 4-4 4|M3 11v-1a4 4 0 0 1 4-4h14|M7 22l-4-4 4-4|M21 13v1a4 4 0 0 1-4 4H3"),
  edit: path("M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z"),
  trash: path("M3.5 6h17|M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6|M5.5 6l1 13a2 2 0 0 0 2 1.9h7a2 2 0 0 0 2-1.9l1-13"),
  copy: raw(
    <>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <Seg d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </>
  ),
  eye: raw(
    <>
      <Seg d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  download: path("M12 3v12|m7.5 10.5 4.5 4.5 4.5-4.5|M4 20h16"),
  send: path("M21.5 2.5 10.5 13.5|M21.5 2.5 14.5 21.5l-4-8-8-4z"),
  lock: raw(
    <>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <Seg d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </>
  ),
  mail: raw(
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <Seg d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  key: raw(
    <>
      <circle cx="7.5" cy="14.5" r="4" />
      <Seg d="m10.5 11.5 8-8|M16 6l2.5 2.5|M14 8l2.5 2.5" />
    </>
  ),

  // --- Domain -----------------------------------------------------------
  layers: path("m12 2 9 5-9 5-9-5z|m3 12 9 5 9-5|m3 17 9 5 9-5"),
  package: raw(
    <>
      <Seg d="M21 8.5v7a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4a2 2 0 0 1-1-1.7v-7a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4a2 2 0 0 1 1 1.7z" />
      <Seg d="m3.3 7.5 8.7 5 8.7-5|M12 21.5v-9" />
    </>
  ),
  chart: path("M4 20V10|M10 20V4|M16 20v-7|M22 20H2"),
  trending: path("M3 17l6-6 4 4 8-8|M15 7h6v6"),
  creditCard: raw(
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <Seg d="M2.5 10h19|M6 15h3" />
    </>
  ),
  bank: path("M3 10h18|M12 3 21 8H3z|M6 10v7|M10 10v7|M14 10v7|M18 10v7|M3 20h18"),
  bell: raw(
    <>
      <Seg d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z" />
      <Seg d="M13.7 19a2 2 0 0 1-3.4 0" />
    </>
  ),
  megaphone: path("M3 11v2a2 2 0 0 0 2 2h1l10 4V5L6 9H5a2 2 0 0 0-2 2z|M18 8.5a4 4 0 0 1 0 7|M7 15v4.5"),
  shield: path("M12 3l8 3v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6z|m9 12 2 2 4-4"),
  globe: raw(
    <>
      <circle cx="12" cy="12" r="9" />
      <Seg d="M3 12h18|M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  palette: raw(
    <>
      <Seg d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .9-1.8 2-1.8h1.5A4.5 4.5 0 0 0 21 10.5C21 6.4 16.9 3 12 3z" />
      <circle cx="7.5" cy="11" r="1.1" />
      <circle cx="10.5" cy="7.5" r="1.1" />
      <circle cx="15" cy="8.5" r="1.1" />
    </>
  ),
  language: path("M3 6h11|M8.5 4v2|M11 6c0 5-3.5 9-8 10|M6 11c1.6 2.7 4 4.6 7 5.5|M13 21l4.5-11 4.5 11|M15 17.5h5"),
  code: path("m8 8-5 4 5 4|m16 8 5 4-5 4|M13.5 5l-3 14"),
  sun: raw(
    <>
      <circle cx="12" cy="12" r="4" />
      <Seg d="M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M4.9 19.1l1.4-1.4|M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: path("M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"),
  zap: path("M13 2 4 14h7l-1 8 9-12h-7z"),
  star: path("m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"),
  starFilled: filled("m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"),
  gift: raw(
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <Seg d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7|M12 8v13" />
      <Seg d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5zM12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5z" />
    </>
  ),
  rocket: path("M5 15c-1.5 1.5-2 6-2 6s4.5-.5 6-2c.8-.8.8-2.2 0-3s-2.2-.8-4-1z|M9 13c-2-3 .5-9 7-11 2 6.5-2 10-5 12z|M14.5 8.5h.01"),
  link: path("M9.5 14.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1|M14.5 9.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1"),
  bitcoin: path("M9 4v16|M13 4v16|M6.5 8H15a3 3 0 0 1 0 6H6.5|M6.5 14H15.5a3 3 0 0 1 0 6H6.5|M6.5 8V20"),
  play: path("M6 4.5v15l13-7.5z"),
  pause: path("M9.5 5v14|M14.5 5v14"),
  document: path("M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z|M14 3v5h5|M9 13h6|M9 17h4"),
  database: raw(
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <Seg d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13|M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  server: raw(
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <Seg d="M7 7.5h.01|M7 16.5h.01" />
    </>
  ),

  // --- Social platforms -------------------------------------------------
  instagram: raw(
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <Seg d="M17 6.8h.01" />
    </>
  ),
  facebook: path("M14.5 8.5V6.8c0-.8.4-1.3 1.4-1.3H17V3h-2.4c-2.4 0-3.6 1.4-3.6 3.6v1.9H9V11h2v10h3.5V11H17l.5-2.5z"),
  youtube: raw(
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="4.5" />
      <Seg d="m10.5 9 5 3-5 3z" />
    </>
  ),
  tiktok: path("M15 3.5c.6 2.3 2.2 3.7 4.5 3.9v3c-1.7.1-3.2-.4-4.5-1.4v6.1a5.9 5.9 0 1 1-5-5.8v3.1a2.8 2.8 0 1 0 2 2.7V3.5z"),
  twitter: path("M3.5 3.5h4l5.2 7 6-7h1.8l-7 8.1 7.4 9.9h-4l-5.5-7.4-6.4 7.4H3.2l7.4-8.6z"),
  telegram: path("M21.5 3.5 2.8 10.9c-.9.4-.9 1 .1 1.3l4.7 1.5 1.8 5.5c.2.6.6.7 1 .3l2.6-2.2 4.7 3.5c.9.5 1.4.2 1.6-.8L22.6 4.6c.2-1.1-.4-1.6-1.1-1.1z|m8.2 13.9 9.8-6.5-8.2 7.5"),
  linkedin: raw(
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <Seg d="M7.5 10.5V17|M7.5 7.2h.01|M11.5 17v-3.6a2.4 2.4 0 0 1 4.8 0V17" />
    </>
  ),
  spotify: raw(
    <>
      <circle cx="12" cy="12" r="9" />
      <Seg d="M7.5 9.5c3-.8 6.2-.5 8.8 1|M8 13c2.4-.6 4.9-.4 7 .8|M8.8 16.2c1.9-.4 3.7-.3 5.4.6" />
    </>
  ),
  discord: path("M9 5.5 8.4 5A16 16 0 0 0 4 6.6C2.5 9 2 12 2.2 15.4a15 15 0 0 0 4.6 2.3l1-1.6a10 10 0 0 1-1.6-.8m11.6.8 1 1.6a15 15 0 0 0 4.6-2.3C22 12 21.5 9 20 6.6A16 16 0 0 0 15.6 5L15 5.5|M9.5 13.5h.01|M14.5 13.5h.01"),

  // --- Payment brands ---------------------------------------------------
  paypal: path("M6.5 20.5 8.8 4h6.4c3 0 4.6 1.6 4.2 4.3-.4 2.9-2.6 4.6-5.7 4.6h-2.6l-1 7.6z|M5.5 17.5 7 8"),
  qrcode: raw(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <Seg d="M14 14h3v3h-3z|M20 14h1|M14 20h1|M18 18h3v3h-3z" />
    </>
  ),
  crypto: raw(
    <>
      <circle cx="12" cy="12" r="9" />
      <Seg d="M9.5 8h4a2.2 2.2 0 0 1 0 4.4h-4zM9.5 12.4h4.4a2.3 2.3 0 0 1 0 4.6H9.5zM9.5 8v9|M11.5 6v2|M11.5 17v2" />
    </>
  ),
} as const;

export type IconName = keyof typeof Icons;

export function Icon({ name, ...props }: { name: IconName } & IconProps) {
  const C = Icons[name] ?? Icons.info;
  return <C {...props} />;
}
