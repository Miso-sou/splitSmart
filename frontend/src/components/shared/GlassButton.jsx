import { cn } from '../../lib/cn'

// variant: 'primary' | 'ghost' | 'danger'
export default function GlassButton({ children, variant = 'primary', className, ...props }) {
  return (
    <button
      {...props}
      className={cn(
        'w-full py-3 px-5 rounded-xl text-sm font-medium transition-all duration-200',
        'active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-accent text-gray-900 font-semibold hover:bg-accent-dim',
        variant === 'ghost' && 'bg-white/[0.07] border border-white/[0.10] text-white hover:bg-white/[0.12]',
        variant === 'danger' && 'bg-danger/20 border border-danger/40 text-danger hover:bg-danger/30',
        className
      )}
    >
      {children}
    </button>
  )
}
