import { Loader2 } from 'lucide-react'

/**
 * Spinner — shared loading indicator.
 * Replaces the 3 duplicate Spinners previously in ChatTab, SummaryTab, StudyNotesTab.
 */
export default function Spinner({ size = 20, className = '', style = {} }) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <Loader2 size={size} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }} />
    </div>
  )
}
