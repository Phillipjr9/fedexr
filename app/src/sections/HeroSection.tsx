import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Package, MapPin, Headphones, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const heroSlides = [
  {
    id: 1,
    title: 'Keep your automotive supply chain moving',
    subtitle: 'From tires to transmissions, FedEx handles every part. Reach customers fast with flexible delivery options and logistics that scale with you.',
    ctaText: 'GEAR UP TO SHIP',
    ctaLink: '/shipping',
    image: '/images/hero-automotive.jpg',
  },
  {
    id: 2,
    title: 'Ship, manage, track, deliver',
    subtitle: 'Reliable shipping solutions for businesses of all sizes. Get your packages where they need to go, on time, every time.',
    ctaText: 'START SHIPPING',
    ctaLink: '/shipping',
    image: '/images/hero-shipping.jpg',
  },
];

const quickActions = [
  { icon: Calculator, label: 'Get a\nquote', href: '/rate-calculator' },
  { icon: Package, label: 'Ship\nnow', href: '/shipping' },
  { icon: MapPin, label: 'Find FedEx\nlocations', href: '/locations' },
  { icon: Headphones, label: 'Contact\nsupport', href: '/support' },
];

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [trackingNumber, setTrackingNumber] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      window.location.href = `/tracking?number=${trackingNumber}`;
    }
  };

  return (
    <section className="relative pt-0 bg-white">
      {/* Hero Carousel */}
      <div className="relative h-[450px] md:h-[500px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            {/* Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${heroSlides[currentSlide].image})` }}
            />
            
            {/* Content Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent" />
            
            {/* Content */}
            <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center h-full">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="max-w-xl"
                >
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-light text-gray-900 leading-tight mb-4">
                    {heroSlides[currentSlide].title}
                  </h1>
                  <p className="text-base md:text-lg text-gray-600 mb-6">
                    {heroSlides[currentSlide].subtitle}
                  </p>
                  <Link
                    to={heroSlides[currentSlide].ctaLink}
                    className="inline-flex items-center text-fedex-link font-semibold text-sm uppercase tracking-wide hover:text-fedex-link-dark transition-colors"
                  >
                    {heroSlides[currentSlide].ctaText}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Slide Indicators */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'bg-fedex-purple w-6'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="relative -mt-16 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-lg shadow-card p-6"
          >
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              {/* Quick Action Buttons */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 md:gap-8">
                {quickActions.map((action, index) => (
                  <motion.div
                    key={action.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                  >
                    <Link
                      to={action.href}
                      className="flex flex-col items-center text-center group"
                    >
                      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-50 group-hover:bg-fedex-purple/10 transition-colors mb-2">
                        <action.icon className="h-6 w-6 text-gray-600 group-hover:text-fedex-purple transition-colors" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 whitespace-pre-line">
                        {action.label}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Tracking Input */}
              <motion.form
                onSubmit={handleTrack}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.8 }}
                className="flex w-full lg:w-auto"
              >
                <Input
                  type="text"
                  placeholder="Tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full lg:w-64 rounded-r-none border-r-0 focus-visible:ring-fedex-purple"
                />
                <Button
                  type="submit"
                  className="rounded-l-none bg-fedex-orange hover:bg-fedex-orange-dark text-white font-semibold uppercase tracking-wide px-6"
                >
                  Track
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.form>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
