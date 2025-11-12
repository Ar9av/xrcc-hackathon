import { motion } from 'framer-motion'
import './MagicButton.css'

interface MagicButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export default function MagicButton({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button'
}: MagicButtonProps) {
  return (
    <motion.button
      type={type}
      className={`magic-button magic-button-${variant} ${className}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <span className="magic-button-content">{children}</span>
      <span className="magic-button-shine" />
    </motion.button>
  )
}

