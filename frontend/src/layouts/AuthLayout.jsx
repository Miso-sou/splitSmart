// Wraps auth pages: centers content vertically + horizontally
// Children should be a GlassCard with the form inside
export default function AuthLayout({ children }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      {children}
    </main>
  )
}
