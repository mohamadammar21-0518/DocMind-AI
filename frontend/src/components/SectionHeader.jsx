import { motion } from 'framer-motion'
import { fadeUp, staggerContainer, staggerItem } from '../motion'

/**
 * SectionHeader — reusable label + title + description header
 * Used by SummaryTab, StudyNotesTab, EvaluationTab.
 */
export default function SectionHeader({ label, title, description, icon }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      style={{ marginBottom: '2rem', textAlign: 'center' }}
    >
      <motion.span
        variants={staggerItem}
        style={{
          display: 'inline-block',
          background: 'rgba(102,126,234,0.12)',
          color: 'var(--accent)',
          borderRadius: '20px',
          padding: '0.3rem 1rem',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          marginBottom: '0.75rem',
        }}
      >
        {icon && <span style={{ marginRight: '0.4rem' }}>{icon}</span>}
        {label}
      </motion.span>
      <motion.h2
        variants={staggerItem}
        style={{
          fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
          fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          marginBottom: '0.5rem',
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          variants={staggerItem}
          style={{
            color: 'var(--text-secondary)',
            maxWidth: 540,
            margin: '0 auto',
            lineHeight: 1.6,
            fontSize: '0.9rem',
          }}
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  )
}
