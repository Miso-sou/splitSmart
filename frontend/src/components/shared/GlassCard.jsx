import { cn } from '../../lib/cn'

export default function GlassCard({ children, className }) {
  return (
    <div className={cn(
      'bg-white/[0.06] backdrop-blur-md border border-white/[0.10] rounded-2xl shadow-glass',
      className
    )}>
      {children}
    </div>
  )
}
