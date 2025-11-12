import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  end: number
  start?: number
  duration?: number
  decimals?: number
  suffix?: string
  prefix?: string
  separator?: string
  className?: string
}

export default function CountUp({
  end,
  start = 0,
  duration = 2,
  decimals = 0,
  suffix = '',
  prefix = '',
  separator = '',
  className = ''
}: CountUpProps) {
  const [count, setCount] = useState(start)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!ref.current || hasAnimated.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const startTime = Date.now()
          const startValue = start
          const endValue = end

          const animate = () => {
            const now = Date.now()
            const elapsed = (now - startTime) / 1000
            const progress = Math.min(elapsed / duration, 1)

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3)
            const current = startValue + (endValue - startValue) * easeOut

            setCount(current)

            if (progress < 1) {
              requestAnimationFrame(animate)
            } else {
              setCount(endValue)
            }
          }

          animate()
        }
      },
      { threshold: 0.1, rootMargin: '-100px' }
    )

    observer.observe(ref.current)

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [start, end, duration])

  const formatNumber = (num: number): string => {
    let formatted = num.toFixed(decimals)
    if (separator && decimals === 0) {
      formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    }
    return `${prefix}${formatted}${suffix}`
  }

  return (
    <span ref={ref} className={className}>
      {formatNumber(count)}
    </span>
  )
}

