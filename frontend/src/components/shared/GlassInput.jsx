import { cn } from '../../lib/cn'

export default function GlassInput({ label, className, children, ...props }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-medium text-white/60">{label}</label>
      )}
      <div className="relative w-full">
        <input
          {...props}
          className={cn(
            'w-full px-4 py-3 rounded-xl text-sm text-white',
            'bg-white/[0.07] border border-white/[0.10]',
            'placeholder:text-white/25',
            'focus:outline-none focus:border-[#B2B1B0] focus:ring-1 focus:ring-[#B2B1B0]/50 focus:bg-white/[0.10]',
            'transition-all duration-200',
            children ? 'pr-10' : '',
            className
          )}
        />
        {children}
      </div>
    </div>
  )
}
