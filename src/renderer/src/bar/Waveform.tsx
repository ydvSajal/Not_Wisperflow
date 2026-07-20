export function Waveform({ levels }: { levels: number[] }): React.JSX.Element {
  return (
    <div className="flex h-8 flex-1 items-center gap-[3px] overflow-hidden">
      {levels.map((level, i) => (
        <span
          key={i}
          className="w-[4px] flex-1 rounded-full bg-accent-soft transition-[height] duration-100"
          style={{ height: `${Math.max(12, level * 100)}%`, opacity: 0.45 + level * 0.55 }}
        />
      ))}
    </div>
  )
}
