import Navbar from '../components/shared/Navbar'

export default function AppLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="pt-20 min-h-screen px-4 sm:px-6 max-w-3xl mx-auto">
        {children}
      </main>
    </>
  )
}
