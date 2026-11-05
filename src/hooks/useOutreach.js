import { useContext } from 'react'
import { OutreachContext } from './outreachContext.js'

export function useOutreach() {
  const context = useContext(OutreachContext)
  if (!context) throw new Error('useOutreach must be used inside OutreachProvider')
  return context
}
