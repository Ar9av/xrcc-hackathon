import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import Aurora from './reactbits/Aurora'
import CountUp from './reactbits/CountUp'
import MagicButton from './reactbits/MagicButton'
import Magnet from './reactbits/Magnet'
import SplitText from './SplitText'
import ScrambledText from './ScrambledText'
import { FloatingFurniture, ParticleField, AnimatedGrid } from './ThreeDScene'
import './LandingPage.css'

interface LandingPageProps {
  onEnterAR: () => void
}

export default function LandingPage({ onEnterAR }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  })

  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.3], [1, 0.8])

  const features = [
    {
      icon: '',
      title: 'Scan & Place Instantly',
      description: 'Point your Quest 2 at any empty room and watch as our AR technology maps the space in real-time. Place furniture with millimeter precision using intuitive hand tracking.',
      color: '#6366f1'
    },
    {
      icon: '',
      title: 'Save $10,000+ Per Listing',
      description: 'Traditional staging costs $3,000-$8,000 per home. DecoratAR eliminates furniture rental, delivery, setup, and storage costs entirely. One-time investment pays for itself in the first listing.',
      color: '#8b5cf6'
    },
    {
      icon: '',
      title: 'Close Deals 3x Faster',
      description: 'Staged homes sell 73% faster than empty ones. With DecoratAR, buyers can visualize their dream home immediately, leading to faster offers and higher closing rates.',
      color: '#ec4899'
    },
    {
      icon: '',
      title: 'Unlimited Design Options',
      description: 'Access thousands of furniture pieces, styles, and arrangements. Switch between modern, traditional, minimalist, or luxury themes instantly—no physical limitations.',
      color: '#10b981'
    },
    {
      icon: '',
      title: 'Share Virtual Tours',
      description: 'Generate stunning 360° virtual tours that buyers can explore from anywhere. Share via link, embed in listings, or present during virtual showings.',
      color: '#f59e0b'
    },
    {
      icon: '',
      title: 'Works Anywhere',
      description: 'No internet? No problem. DecoratAR works offline once downloaded. Stage homes in remote locations, basements, or anywhere your business takes you.',
      color: '#06b6d4'
    }
  ]

  const stats = [
    { value: 85, suffix: '%', label: 'Cost Reduction', description: 'Compared to traditional staging' },
    { value: 3, suffix: 'x', label: 'Faster Sales', description: 'Average time on market reduction' },
    { value: 10000, prefix: '$', separator: ',', label: 'Average Savings', description: 'Per agent per year' },
    { value: 500, suffix: '+', label: 'Happy Agents', description: 'Using DecoratAR daily' },
    { value: 92, suffix: '%', label: 'Buyer Satisfaction', description: 'Prefer AR-staged homes' },
    { value: 50, suffix: '%', label: 'Higher Offers', description: 'On staged vs unstaged homes' }
  ]

  const steps = [
    {
      number: '01',
      title: 'Scan the Space',
      description: 'Put on your Quest 2 headset and scan the empty room. Our advanced AR technology creates a precise 3D map of the space in seconds.',
      icon: ''
    },
    {
      number: '02',
      title: 'Choose Your Style',
      description: 'Browse our extensive catalog of furniture and decor. Filter by style, color, size, or room type. Preview items in real-time before placing.',
      icon: ''
    },
    {
      number: '03',
      title: 'Place & Arrange',
      description: 'Use intuitive hand gestures to place furniture exactly where you want it. Rotate, resize, and rearrange with natural movements.',
      icon: ''
    },
    {
      number: '04',
      title: 'Share & Sell',
      description: 'Generate professional virtual tours and share with buyers instantly. Export high-quality renders for marketing materials.',
      icon: ''
    }
  ]

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Top Producer, Century 21',
      location: 'San Francisco, CA',
      image: '',
      quote: 'DecoratAR transformed my business. I used to spend $5,000 per listing on staging. Now I stage 10 homes for the same cost. My listings sell 40% faster.',
      rating: 5
    },
    {
      name: 'Michael Rodriguez',
      role: 'Luxury Real Estate Specialist',
      location: 'Miami, FL',
      image: '',
      quote: 'The quality of virtual staging is incredible. Buyers can\'t tell the difference, and I can show multiple design options in the same space. Game changer.',
      rating: 5
    },
    {
      name: 'Emily Johnson',
      role: 'Real Estate Broker',
      location: 'Austin, TX',
      image: '',
      quote: 'I love how I can stage a home in 30 minutes instead of 3 days. The Quest 2 integration is seamless, and my clients are amazed by the results.',
      rating: 5
    }
  ]

  const problems = [
    {
      title: 'Expensive Furniture Rental',
      description: 'Agents spend $3,000-$8,000 per listing on furniture rental, delivery, and setup. These costs eat into profits and limit how many homes you can stage.',
      icon: ''
    },
    {
      title: 'Time-Consuming Setup',
      description: 'Traditional staging takes 2-3 days of coordination, delivery windows, and physical labor. Time you could spend closing more deals.',
      icon: ''
    },
    {
      title: 'Limited Design Options',
      description: 'You\'re restricted to what\'s available in rental catalogs. Can\'t easily switch styles or try different arrangements without additional costs.',
      icon: ''
    },
    {
      title: 'Storage & Logistics',
      description: 'Managing furniture storage, coordinating deliveries, and handling returns creates operational headaches and additional expenses.',
      icon: ''
    }
  ]

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
            <span className="nav-logo-icon"></span>
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
            Real estate agents waste thousands on furniture rental for every listing. 
            <strong> DecoratAR eliminates these costs</strong> by letting you stage homes with 
            <strong> virtual furniture in AR</strong>. Use your Quest 2/Quest 3 to scan empty spaces and 
            place photorealistic furniture instantly. <strong>Save money, stage faster, close more deals.</strong>
          </ScrambledText>

          <motion.div
            className="hero-cta"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <Magnet magnitude={0.25}>
              <MagicButton variant="primary" onClick={onEnterAR} className="hero-button">
                Start Staging Free
              </MagicButton>
            </Magnet>
            <MagicButton variant="secondary" className="hero-button">
              Watch 2-Min Demo
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
              <span>Setup in 5 Minutes</span>
              <span>Made for XRCC Hackathon</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      {/* <section className="problem-section">
        <div className="section-container">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="section-title">The Staging Problem</h2>
            <p className="section-subtitle">
              Traditional home staging is expensive, time-consuming, and limits your ability to showcase properties effectively
            </p>
          </motion.div>

          <div className="problems-grid">
            {problems.map((problem, index) => (
              <Magnet key={index} magnitude={0.1}>
                <motion.div
                  className="problem-card"
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <div className="problem-icon">{problem.icon}</div>
                  <h3 className="problem-title">{problem.title}</h3>
                  <p className="problem-description">{problem.description}</p>
                </motion.div>
              </Magnet>
            ))}
          </div>
        </div>
      </section> */}

      {/* Stats Section */}
      {/* <section className="stats-section">
        <div className="section-container">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="section-title">Proven Results</h2>
            <p className="section-subtitle">
              Real numbers from agents using DecoratAR to transform their business
            </p>
          </motion.div>

          <div className="stats-container">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                className="stat-card"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.6, delay: index * 0.08, type: 'spring' }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <div className="stat-value">
                  <CountUp
                    end={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    separator={stat.separator}
                    duration={2.5}
                    className="stat-number"
                  />
                </div>
                <div className="stat-label">{stat.label}</div>
                <div className="stat-description">{stat.description}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section> */}

      {/* How It Works */}
      {/* <section className="how-it-works-section">
        <div className="section-container">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">
              Stage a home in 30 minutes, not 3 days. Here's how simple it is:
            </p>
          </motion.div>

          <div className="steps-container">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                className="step-item"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
              >
                <div className="step-number">{step.number}</div>
                <div className="step-content">
                  <div className="step-icon">{step.icon}</div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-description">{step.description}</p>
                </div>
                {index < steps.length - 1 && <div className="step-connector" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Features Section */}
      {/* <section className="features-section">
        <div className="section-container">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="section-title">Everything You Need to Succeed</h2>
            <p className="section-subtitle">
              Powerful features designed specifically for real estate professionals
            </p>
          </motion.div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <Magnet key={index} magnitude={0.15} maxDistance={120}>
                <motion.div
                  className="feature-card"
                  initial={{ opacity: 0, y: 50, rotateX: -15 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.08 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  style={{ borderTopColor: feature.color }}
                >
                  <div className="feature-icon" style={{ background: `${feature.color}20` }}>
                    {feature.icon}
                  </div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                  <div className="feature-glow" style={{ background: feature.color }} />
                </motion.div>
              </Magnet>
            ))}
          </div>
        </div>
      </section> */}

      {/* Testimonials */}
      {/* <section className="testimonials-section">
        <div className="section-container">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="section-title">Loved by Real Estate Professionals</h2>
            <p className="section-subtitle">
              See what agents are saying about DecoratAR
            </p>
          </motion.div>

          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                className="testimonial-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="testimonial-rating">
                  {'★'.repeat(testimonial.rating)}
                </div>
                <p className="testimonial-quote">"{testimonial.quote}"</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{testimonial.image}</div>
                  <div className="testimonial-info">
                    <div className="testimonial-name">{testimonial.name}</div>
                    <div className="testimonial-role">{testimonial.role}</div>
                    <div className="testimonial-location">{testimonial.location}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section> */}

      {/* CTA Section */}
      {/* <section className="cta-section">
        <div className="cta-container">
          <motion.div
            className="cta-content"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="cta-icon"
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
            >
            </motion.div>
            <h2 className="cta-title">Ready to Transform Your Real Estate Business?</h2>
            <p className="cta-description">
              Join 500+ agents who are saving thousands, staging faster, and closing more deals with DecoratAR.
              <br />
              <strong>Start staging your first home in 5 minutes—completely free.</strong>
            </p>
            <div className="cta-buttons">
              <Magnet magnitude={0.3}>
                <MagicButton variant="primary" onClick={onEnterAR} className="cta-button">
                  Start Staging Free
                </MagicButton>
              </Magnet>
              <MagicButton variant="secondary" className="cta-button">
                Schedule Demo
              </MagicButton>
            </div>
            <div className="cta-guarantee">
              <span>30-Day Money-Back Guarantee</span>
              <span>Cancel Anytime</span>
              <span>No Setup Fees</span>
            </div>
          </motion.div>
        </div>
      </section> */}

      {/* Footer */}
      {/* <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-brand">
              <span className="logo-icon"></span>
              <span className="logo-text">DecoratAR</span>
              <p>AR Home Staging for Real Estate Professionals</p>
            </div>
            <div className="footer-links">
              <div className="footer-column">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
                <a href="#demo">Demo</a>
              </div>
              <div className="footer-column">
                <h4>Resources</h4>
                <a href="#docs">Documentation</a>
                <a href="#tutorials">Tutorials</a>
                <a href="#support">Support</a>
              </div>
              <div className="footer-column">
                <h4>Company</h4>
                <a href="#about">About</a>
                <a href="#blog">Blog</a>
                <a href="#contact">Contact</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 DecoratAR. All rights reserved.</p>
          </div>
        </div>
      </footer> */}
    </div>
  )
}
