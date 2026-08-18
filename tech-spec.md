# FedEx Website Technical Specification

## 1. Tech Stack Overview

| Category | Technology |
|----------|------------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS 3.4 |
| UI Components | shadcn/ui |
| Animation | Framer Motion |
| Icons | Lucide React |
| State Management | React useState/useContext |

## 2. Tailwind Configuration

```javascript
// tailwind.config.js extensions
{
  theme: {
    extend: {
      colors: {
        'fedex-purple': '#4D148C',
        'fedex-purple-dark': '#3A1070',
        'fedex-orange': '#FF6600',
        'fedex-orange-dark': '#E55A00',
        'fedex-link': '#007AB8',
        'fedex-link-dark': '#005A8C',
        'fedex-gray': '#F3F3F3',
        'fedex-info': '#F0F7FA',
      },
      fontFamily: {
        'fedex': ['Arial', 'Helvetica', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
}
```

## 3. Component Inventory

### Shadcn/UI Components (Pre-installed)

| Component | Usage | Style Overrides |
|-----------|-------|-----------------|
| Button | CTAs, actions | Custom colors, uppercase text |
| Input | Tracking field | Border color, focus states |
| Sheet | Mobile menu | Slide from right |
| Accordion | FAQ sections | Custom styling |

### Custom Components

#### Layout Components

```typescript
// Header.tsx
interface HeaderProps {
  isScrolled?: boolean;
}

// Footer.tsx
interface FooterProps {
  // No props needed
}

// SectionWrapper.tsx
interface SectionWrapperProps {
  children: React.ReactNode;
  className?: string;
  background?: 'white' | 'gray' | 'purple';
}
```

#### Section Components

```typescript
// HeroSection.tsx
interface HeroSlide {
  id: number;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  image: string;
}

// QuickActionsBar.tsx
interface QuickAction {
  icon: LucideIcon;
  label: string;
  link: string;
}

// FeatureGrid.tsx
interface Feature {
  title: string;
  description: string;
}

// TwoColumnSection.tsx
interface TwoColumnSectionProps {
  title: string;
  subtitle?: string;
  description: string;
  ctaText?: string;
  ctaLink?: string;
  image: string;
  imagePosition: 'left' | 'right';
  background?: 'white' | 'gray';
}
```

#### Animation Components

```typescript
// FadeInOnScroll.tsx
interface FadeInOnScrollProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

// StaggerContainer.tsx
interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
}
```

## 4. Animation Implementation Plan

| Interaction Name | Tech Choice | Implementation Logic |
|------------------|-------------|----------------------|
| Page Load | Framer Motion | `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}` on main container |
| Hero Content Reveal | Framer Motion | `staggerChildren: 0.1`, each child fades in + slides up |
| Hero Carousel | React State + CSS | Auto-advance with `setInterval`, fade transition between slides |
| Scroll Reveal | Framer Motion | `whileInView` with `viewport={{ once: true, amount: 0.3 }}` |
| Button Hover | Tailwind + FM | `whileHover={{ scale: 1.02 }}`, Tailwind for color/shadow |
| Card Hover | Framer Motion | `whileHover={{ y: -4, boxShadow: '...' }}` |
| Nav Dropdown | CSS + Framer | `AnimatePresence` for mount/unmount, slide down |
| Mobile Menu | Framer Motion | Sheet slides from right, content staggers in |
| Link Underline | CSS | `after` pseudo-element, scaleX animation |
| Icon Hover | Tailwind | `group-hover` for color/scale changes |

### Animation Timing Reference

| Animation | Duration | Easing | Delay |
|-----------|----------|--------|-------|
| Fade In | 600ms | cubic-bezier(0.4, 0, 0.2, 1) | 0ms |
| Slide Up | 600ms | cubic-bezier(0.4, 0, 0.2, 1) | 0ms |
| Button Hover | 200ms | cubic-bezier(0.4, 0, 0.2, 1) | 0ms |
| Card Hover | 300ms | cubic-bezier(0.4, 0, 0.2, 1) | 0ms |
| Dropdown | 200ms | cubic-bezier(0.4, 0, 0.2, 1) | 0ms |
| Stagger | 100ms | - | per item |
| Carousel | 600ms | ease-in-out | 5000ms auto |

## 5. Project File Structure

```
/mnt/okcomputer/output/app/
├── public/
│   ├── images/
│   │   ├── hero-automotive.jpg
│   │   ├── hero-shipping.jpg
│   │   ├── fedex-employee.jpg
│   │   ├── delivery-options.jpg
│   │   ├── delivery-manager.jpg
│   │   ├── apple-watch.jpg
│   │   ├── sustainability.jpg
│   │   └── fedex-rewards.jpg
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── MobileMenu.tsx
│   │   ├── HeroCarousel.tsx
│   │   ├── QuickActionsBar.tsx
│   │   ├── AlertBanner.tsx
│   │   ├── FeatureGrid.tsx
│   │   ├── TwoColumnSection.tsx
│   │   ├── ComparisonSection.tsx
│   │   ├── BannerSection.tsx
│   │   ├── NoticeSection.tsx
│   │   └── animations/
│   │       ├── FadeInOnScroll.tsx
│   │       └── StaggerContainer.tsx
│   ├── sections/
│   │   ├── HeroSection.tsx
│   │   ├── WhyShipSection.tsx
│   │   ├── DeliveryOptionsSection.tsx
│   │   ├── DeliveryManagerSection.tsx
│   │   ├── AppleWatchSection.tsx
│   │   ├── ComparisonSection.tsx
│   │   ├── BusinessAdvantageSection.tsx
│   │   ├── SustainabilitySection.tsx
│   │   ├── RewardsSection.tsx
│   │   └── NoticesSection.tsx
│   ├── hooks/
│   │   └── useScrollPosition.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 6. Package Installation List

```bash
# Animation library
npm install framer-motion

# Icons
npm install lucide-react

# Utility
npm install clsx tailwind-merge
```

## 7. Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| sm | 640px | Small tablets |
| md | 768px | Tablets |
| lg | 1024px | Small desktops |
| xl | 1280px | Large desktops |
| 2xl | 1536px | Extra large |

## 8. Key Implementation Notes

1. **Header**: Fixed position, z-index 50, background changes on scroll
2. **Hero Carousel**: Use React state for active slide, auto-advance with useEffect
3. **Quick Actions Bar**: Absolute positioned, overlapping hero bottom
4. **Scroll Animations**: Use Framer Motion's `whileInView` for performance
5. **Images**: Use lazy loading with `loading="lazy"` attribute
6. **Accessibility**: Include proper ARIA labels, focus states, reduced-motion support
7. **Mobile Menu**: Use shadcn Sheet component, slide from right
8. **Footer**: Grid layout, responsive columns
