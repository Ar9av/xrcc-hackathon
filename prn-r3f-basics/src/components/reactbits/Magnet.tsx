import { useRef, useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

interface MagnetProps {
  children: React.ReactNode
  magnitude?: number
  maxDistance?: number
  className?: string
}

export default function Magnet({
  children,
  magnitude = 0.3,
  maxDistance = 150,
  className = ''
}: MagnetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springConfig = { damping: 20, stiffness: 150 }
  const xSpring = useSpring(x, springConfig)
  const ySpring = useSpring(y, springConfig)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return

      const rect = ref.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const distanceX = e.clientX - centerX
      const distanceY = e.clientY - centerY
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)

      if (distance < maxDistance) {
        const force = (1 - distance / maxDistance) * magnitude
        x.set(distanceX * force)
        y.set(distanceY * force)
      } else {
        x.set(0)
        y.set(0)
      }
    }

    const handleMouseLeave = () => {
      x.set(0)
      y.set(0)
      setIsHovered(false)
    }

    const handleMouseEnter = () => {
      setIsHovered(true)
    }

    const element = ref.current
    if (element) {
      element.addEventListener('mousemove', handleMouseMove)
      element.addEventListener('mouseleave', handleMouseLeave)
      element.addEventListener('mouseenter', handleMouseEnter)
    }

    return () => {
      if (element) {
        element.removeEventListener('mousemove', handleMouseMove)
        element.removeEventListener('mouseleave', handleMouseLeave)
        element.removeEventListener('mouseenter', handleMouseEnter)
      }
    }
  }, [magnitude, maxDistance, x, y])

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        x: xSpring,
        y: ySpring,
        cursor: isHovered ? 'pointer' : 'default'
      }}
    >
      {children}
    </motion.div>
  )
}

