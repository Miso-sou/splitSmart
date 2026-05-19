import { cn } from '../../lib/cn'

export default function LoadingSpinner({ size = 'md', className }) {
  const s = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }[size]
  return (
    <div className={cn(
      s,
      'rounded-full border-2 border-white/20 border-t-accent animate-spin',
      className
    )} />
  )
}
