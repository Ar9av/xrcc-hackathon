import { useEffect, useRef } from 'react'
import './Aurora.css'

interface AuroraProps {
  colors?: string[]
  speed?: number
  blur?: number
  opacity?: number
  className?: string
}

export default function Aurora({
  colors = ['#6366f1', '#8b5cf6', '#ec4899'],
  speed = 0.5,
  blur = 100,
  opacity = 0.6,
  className = ''
}: AuroraProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const gradient = container.querySelector('.aurora-gradient') as HTMLElement

    let animationId: number
    let time = 0

    const animate = () => {
      time += speed * 0.01
      if (gradient) {
        const x = 50 + Math.sin(time) * 20
        const y = 50 + Math.cos(time * 0.8) * 20
        gradient.style.background = `radial-gradient(circle at ${x}% ${y}%, ${colors[0]} 0%, ${colors[1]} 30%, ${colors[2]} 60%, transparent 100%)`
      }
      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [colors, speed])

  return (
    <div
      ref={containerRef}
      className={`aurora-container ${className}`}
      style={{
        filter: `blur(${blur}px)`,
        opacity
      }}
    >
      <div className="aurora-gradient" />
    </div>
  )
}

