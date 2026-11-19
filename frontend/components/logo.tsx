/**
 * The brand mark. Served from /logo-mark.svg so the same geometry is used by the
 * wordmark, the favicon, and the printed proposal.
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG mark is
    // cheaper than running the image optimiser for a 1 KB asset.
    <img
      src="/logo-mark.svg"
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[--radius]"
      style={{ borderRadius: size * 0.22 }}
      aria-hidden
    />
  );
}
