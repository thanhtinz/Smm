export default function Logo({ text, size = 34 }: { text: string; size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <defs>
          <linearGradient id="novaLogoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#novaLogoGrad)" opacity="0.16" />
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" stroke="url(#novaLogoGrad)" strokeWidth="1.6" />
        <path
          d="M13 27V13l14 14V13"
          stroke="url(#novaLogoGrad)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[1.05rem] font-bold tracking-tight">{text}</span>
    </span>
  );
}
