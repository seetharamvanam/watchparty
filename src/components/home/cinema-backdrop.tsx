export function CinemaBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-void" />
      <div className="absolute -top-32 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,168,124,0.16),transparent_64%)] blur-2xl" />
      <div className="absolute bottom-0 left-0 right-0 h-2/5 bg-[radial-gradient(ellipse_at_bottom,rgba(196,122,90,0.08),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(11,10,15,0.85)_100%)]" />
    </div>
  );
}
