'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  // Invert theme logic as requested: Dark Mode -> Light Toast, Light Mode -> Dark Toast
  const invertedTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'system';

  return (
    <Sonner
      theme={invertedTheme as ToasterProps['theme']}
      className="toaster group"
      {...props}
    />
  )
}

export { Toaster }
