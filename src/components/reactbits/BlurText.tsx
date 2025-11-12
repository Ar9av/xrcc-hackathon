import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import './BlurText.css'

interface BlurTextProps {
  text: string
  delay?: number
  className?: string
  animateBy?: 'characters' | 'words'
  direction?: 'top' | 'bottom' | 'left' | 'right'
  startVisible?: boolean
}

export default function BlurText({
  text,
  delay = 100,
  className = '',
  animateBy = 'words',
  direction = 'bottom',
  startVisible = false
}: BlurTextProps) {
  const [isVisible, setIsVisible] = useState(startVisible)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // If startVisible is true, trigger animation immediately
    if (startVisible) {
      // Small delay to ensure smooth animation start
      const timer = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(timer)
    }

    // Check if element is already in viewport on mount
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const isInView = rect.top < window.innerHeight && rect.bottom > 0
      if (isInView) {
        // Small delay to ensure smooth animation
        setTimeout(() => setIsVisible(true), 100)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [startVisible])

  const getInitialPosition = () => {
    // If startVisible is true, start visible but slightly offset for smooth animation
    if (startVisible) {
      switch (direction) {
        case 'top':
          return { y: -20, opacity: 0.8, filter: 'blur(5px)' }
        case 'bottom':
          return { y: 20, opacity: 0.8, filter: 'blur(5px)' }
        case 'left':
          return { x: -20, opacity: 0.8, filter: 'blur(5px)' }
        case 'right':
          return { x: 20, opacity: 0.8, filter: 'blur(5px)' }
        default:
          return { y: 20, opacity: 0.8, filter: 'blur(5px)' }
      }
    }
    // Normal initial position for scroll-triggered animations
    switch (direction) {
      case 'top':
        return { y: -50, opacity: 0, filter: 'blur(20px)' }
      case 'bottom':
        return { y: 50, opacity: 0, filter: 'blur(20px)' }
      case 'left':
        return { x: -50, opacity: 0, filter: 'blur(20px)' }
      case 'right':
        return { x: 50, opacity: 0, filter: 'blur(20px)' }
      default:
        return { y: 50, opacity: 0, filter: 'blur(20px)' }
    }
  }

  const getAnimatePosition = () => {
    return { x: 0, y: 0, opacity: 1, filter: 'blur(0px)' }
  }

  if (animateBy === 'words') {
    const words = text.split(' ')
    return (
      <div ref={ref} className={`blur-text-container ${className}`}>
        {words.map((word, index) => (
          <motion.span
            key={index}
            className="blur-text-word"
            initial={getInitialPosition()}
            animate={isVisible ? getAnimatePosition() : getInitialPosition()}
            transition={{
              duration: 0.6,
              delay: index * (delay / 1000),
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
          >
            {word}{' '}
          </motion.span>
        ))}
      </div>
    )
  }

  const characters = text.split('')
  return (
    <div ref={ref} className={`blur-text-container ${className}`}>
      {characters.map((char, index) => (
        <motion.span
          key={index}
          className="blur-text-char"
          initial={getInitialPosition()}
          animate={isVisible ? getAnimatePosition() : getInitialPosition()}
          transition={{
            duration: 0.4,
            delay: index * (delay / 1000),
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </div>
  )
}

