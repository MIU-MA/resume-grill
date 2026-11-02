import { createContext, useContext } from 'react'

export type SettingsTab = 'model' | 'mail' | 'local'
export type ShellApi = {
  openSettings: (tab?: SettingsTab) => void
  openNav: () => void
}
export const ShellContext = createContext<ShellApi>({ openSettings: () => undefined, openNav: () => undefined })
export function useAppShell() { return useContext(ShellContext) }
