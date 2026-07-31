/**
 * Live level meter for the recording pill. Heights come from the real RMS the
 * recorder reports, so this is a meter, not a decorative loop. When the mic is
 * quiet the bars fall back to a slow breathe so the pill still reads as live.
 */
export function Waveform({ levels }: { levels: number[] }): React.JSX.Element {
  const quiet = levels.every((l) => l < 0.02)
  return (
    <div className="flex h-4 items-center gap-[2px]">
      {levels.map((level, i) => (
        <span
          key={i}
          className={`w-[2px] origin-center rounded-full bg-white/90 transition-[height] duration-75 ${
            quiet ? 'animate-breathe' : ''
          }`}
          style={{
            height: `${Math.max(15, level * 100)}%`,
            animationDelay: quiet ? `${i * 90}ms` : undefined
          }}
        />
      ))}
    </div>
  )
}
