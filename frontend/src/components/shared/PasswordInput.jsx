import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import GlassInput from './GlassInput'

export default function PasswordInput({ label, value, onChange, placeholder, id, ...props }) {
  const [show, setShow] = useState(false)

  return (
    <GlassInput
      id={id}
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    >
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors flex items-center justify-center p-1 rounded-md hover:bg-white/[0.05]"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </GlassInput>
  )
}
