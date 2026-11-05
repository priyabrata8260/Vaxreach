import { useContext } from 'react'
import { ChildrenContext } from './childrenContext.js'

export function useChildren() {
  const context = useContext(ChildrenContext)
  if (!context) throw new Error('useChildren must be used inside ChildrenProvider')
  return context
}
