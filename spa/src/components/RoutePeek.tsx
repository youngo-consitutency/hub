import { SidePanel } from './SidePanel.tsx'

export function RoutePeek({ children }: any) {
  return (
    <SidePanel title="Quick view" showTitle={false} onClose={() => window.history.back()}>
      {children}
    </SidePanel>
  )
}
