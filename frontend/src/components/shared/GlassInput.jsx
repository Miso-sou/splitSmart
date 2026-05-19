import { cn } from '../../lib/cn'

export default function GlassInput({ label, className, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-white/60">{label}</label>
      )}
      <input
        {...props}
        className={cn(
          'w-full px-4 py-3 rounded-xl text-sm text-white',
          'bg-white/[0.07] border border-white/[0.10]',
          'placeholder:text-white/25',
          'focus:outline-none focus:border-accent/50 focus:bg-white/[0.10]',
          'transition-all duration-200',
          className
        )}
      />
    </div>
  )
}
