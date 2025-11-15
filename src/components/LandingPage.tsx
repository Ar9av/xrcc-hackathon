import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import Aurora from './reactbits/Aurora'
import MagicButton from './reactbits/MagicButton'
import Magnet from './reactbits/Magnet'
// @ts-expect-error - JSX files don't have type definitions
import SplitText from './SplitText'
// @ts-expect-error - JSX files don't have type definitions
import ScrambledText from './ScrambledText'
import { FloatingFurniture, ParticleField, AnimatedGrid } from './ThreeDScene'
import './LandingPage.css'

interface LandingPageProps {
  onEnterAR: () => void
  onEnterDefaultView: () => void
}

export default function LandingPage({ onEnterAR, onEnterDefaultView }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  })

  // Keep 3D asset visible at all times - no fade on scroll
  const opacity = useTransform(scrollYProgress, [0, 1], [0.6, 0.6])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1])


  return (
    <div className="landing-page" ref={containerRef}>
      <Aurora
        colors={['#6366f1', '#8b5cf6', '#ec4899', '#10b981']}
        speed={0.4}
        blur={150}
        opacity={0.5}
      />

      {/* Navigation */}
      <nav className="landing-nav">
        <motion.div
          className="nav-pill"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="nav-logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <img src="/logo.png" alt="DecoratAR Logo" className="nav-logo-icon" />
            <span className="nav-logo-text">DecoratAR</span>
          </motion.div>
          <motion.div
            className="nav-divider"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          />
          <motion.div
            className="nav-button-wrapper"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <MagicButton variant="ghost" onClick={onEnterAR} className="nav-ar-button">
              Try AR Experience
            </MagicButton>
          </motion.div>
        </motion.div>
      </nav>

      {/* Hero Section with 3D */}
      <section className="hero-section">
        <motion.div
          className="hero-3d-container"
          style={{ opacity, scale }}
        >
          <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
            <PerspectiveCamera makeDefault position={[0, 2, 5]} fov={50} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8b5cf6" />
            <FloatingFurniture />
            <ParticleField />
            <AnimatedGrid />
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
          </Canvas>
        </motion.div>

        <div className="hero-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hero-badge"
          >
            <span className="badge-sparkle"></span>
            <span>The Future of Home Staging is Here</span>
            <span className="badge-sparkle"></span>
          </motion.div>

          <SplitText
            text="Stage Homes Without Furniture. Close Deals Faster."
            className="hero-title"
            delay={30}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.1}
            rootMargin="-100px"
            textAlign="center"
            tag="h1"
            onLetterAnimationComplete={() => {
              console.log('All letters have animated!');
            }}
          />

          <ScrambledText
            className="hero-description"
            radius={30}
            duration={1.2}
            speed={0.5}
            scrambleChars=".:"
          >
            Real estate agents waste thousands on furniture rental for every listing.{' '}
            <strong>DecoratAR eliminates these costs</strong> by letting you stage homes with{' '}
            <strong>virtual furniture in AR</strong>. Use your Quest 2/Quest 3 to scan empty spaces and place photorealistic furniture instantly.{' '}
            <strong>Save money, stage faster, close more deals.</strong>
          </ScrambledText>

          <motion.div
            className="hero-cta"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <Magnet magnitude={0.1}>
              <MagicButton variant="secondary" onClick={onEnterAR} className="hero-button">
                Start Staging Free
              </MagicButton>
            </Magnet>
            <MagicButton variant="secondary" onClick={onEnterDefaultView} className="hero-button">
              View in Browser
            </MagicButton>
          </motion.div>

          <motion.div
            className="hero-trust"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            <div className="trust-badges">
              <span>No Credit Card Required</span>
              <span>Setup in 3 Minutes</span>
              <span>Made for XRCC Hackathon</span>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
