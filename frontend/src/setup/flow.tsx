import { createContext, useContext, type ReactNode } from 'react'
import type { AppState, KeyStatus, Profile, Reference } from '../api'

export type Mode = 'setup' | 'settings'

export interface FlowValue {
  mode: Mode
  state: AppState
  reference: Reference | null
  setProfile: (p: Profile) => void
  setKeys: (k: Record<string, KeyStatus>) => void
  /** Setup: go to the next step. Settings: show that the section saved. */
  next: () => void
  back: () => void
}

const FlowContext = createContext<FlowValue | null>(null)

export function FlowProvider({ value, children }: { value: FlowValue; children: ReactNode }) {
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}

export function useFlow(): FlowValue {
  const value = useContext(FlowContext)
  if (!value) throw new Error('useFlow must be used inside FlowProvider')
  return value
}

export interface StepDef {
  id: string
  group: string
  component: () => ReactNode
}
