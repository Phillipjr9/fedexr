import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserCircle,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import BrandImage from '@/components/BrandImage';
import { siteImages } from '@/lib/siteAssets';
import { useWorkspace } from '@/context/workspace';

const navigation = [
  {
    label: 'Shipping',
    key: 'shipping',
    href: '/shipping',
    links: [
      { label: 'Shipping overview', href: '/shipping' },
      { label: 'Create a shipment', href: '/shipping/create' },
      { label: 'Get rates & delivery times', href: '/rate-calculator' },
      { label: 'Schedule a pickup', href: '/shipping/pickup' },
      { label: 'Order shipping supplies', href: '/store' },
      { label: 'Return a package', href: '/returns' },
    ],
  },
  {
    label: 'Tracking',
    key: 'tracking',
    href: '/tracking',
    links: [
      { label: 'Track a package', href: '/tracking' },
    ],
  },
  {
    label: 'Design & Print',
    key: 'design_print',
    href: '/design-print',
    links: [
      { label: 'Explore printing services', href: '/design-print' },
      { label: 'Business cards', href: '/design-print?product=business-cards' },
      { label: 'Posters', href: '/design-print?product=posters' },
    ],
  },
  {
    label: 'Locations',
    key: 'locations',
    href: '/locations',
    links: [
      { label: 'Find a FedEx location', href: '/locations' },
      { label: 'Drop off a package', href: '/locations' },
      { label: 'Hold for pickup', href: '/locations' },
    ],
  },
  {
    label: 'Support',
    key: 'support',
    href: '/support',
    links: [
      { label: 'Customer support', href: '/support' },
      { label: 'Frequently asked questions', href: '/support' },
      { label: 'Returns & claims', href: '/returns' },
    ],
  },
];

const searchPages = [
  {
    label: 'Track a package',
    description: 'Check your shipment status',
    href: '/tracking',
    keywords: 'tracking delivery package',
  },
  {
    label: 'Create a shipment',
    description: 'Prepare your next shipment',
    href: '/shipping/create',
    keywords: 'shipping ship label',
  },
  {
    label: 'Get a shipping quote',
    description: 'Compare rates and shipping options',
    href: '/rate-calculator',
    keywords: 'rates price cost calculator',
  },
  {
    label: 'Schedule a pickup',
    description: 'Prepare a plan and continue to FedEx booking',
    href: '/shipping/pickup',
    keywords: 'collection collect pickup driver',
  },
  {
    label: 'Find a FedEx location',
    description: 'Find shipping, printing, and drop-off locations',
    href: '/locations',
    keywords: 'store address drop off hours',
  },
  {
    label: 'Design & print',
    description: 'Explore printing services',
    href: '/design-print',
    keywords: 'business cards posters banners',
  },
  {
    label: 'Customer support',
    description: 'Find answers and contact support',
    href: '/support',
    keywords: 'help contact questions',
  },
  {
    label: 'Returns & claims',
    description: 'Prepare notes and find return or claim tools',
    href: '/returns',
    keywords: 'return returns refund claim claims damage damaged',
  },
  {
    label: 'Shipping supplies',
    description: 'Browse packaging and supplies',
    href: '/store',
    keywords: 'boxes envelope tape',
  },
];

export default function Header() {
  const { t } = useTranslation();
  const { user, signOut } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const query = searchQuery.trim().toLowerCase();
  const searchResults = searchPages.filter((page) =>
    `${page.label} ${page.description} ${page.keywords}`.toLowerCase().includes(query),
  );

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="site-container header-inner">
          <Link to="/" aria-label="FedEx home" className="brand-logo">
            <BrandImage image={siteImages.logo} priority />
          </Link>

          <nav aria-label="Main navigation" className="desktop-navigation">
            {navigation.map((item) => (
              <DropdownMenu key={item.key}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`header-nav-button ${location.pathname.startsWith(item.href) ? 'is-active' : ''}`}
                  >
                    {t(`nav.${item.key}`, item.label)}
                    <ChevronDown size={13} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={0} className="header-dropdown">
                  {item.links.map((link) => (
                    <DropdownMenuItem key={link.label} asChild className="header-dropdown-link">
                      <Link to={link.href}>{link.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </nav>

          <div className="header-actions">
            {user ? (
              <div className="header-account-control">
                <Link
                  to={user.role === 'admin' ? '/admin' : '/dashboard'}
                  className="header-account"
                  aria-label={user.role === 'admin' ? 'Open the dashboard' : 'Open my account'}
                >
                  <span>{user.role === 'admin' ? 'Dashboard' : 'My Account'}</span>
                  {user.role === 'admin' ? (
                    <ShieldCheck size={26} strokeWidth={1.25} aria-hidden="true" />
                  ) : (
                    <UserCircle size={26} strokeWidth={1.25} aria-hidden="true" />
                  )}
                </Link>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="header-icon-button header-account-toggle"
                      aria-label="Account access options"
                    >
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="header-dropdown header-account-dropdown"
                  >
                    <DropdownMenuLabel className="header-account-menu-label">
                      {user.name || user.email}
                    </DropdownMenuLabel>
                    {user.role === 'admin' ? (
                      <>
                        <DropdownMenuItem asChild className="header-dropdown-link">
                          <Link to="/admin">
                            <Truck size={18} aria-hidden="true" />
                            Shipment Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="header-dropdown-link">
                          <Link to="/admin/settings">
                            <Settings size={18} aria-hidden="true" />
                            Workspace Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="header-dropdown-link">
                          <Link to="/admin/settings?tab=security">
                            <UserCircle size={18} aria-hidden="true" />
                            Profile settings
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem asChild className="header-dropdown-link">
                          <Link to="/dashboard">
                            <LayoutDashboard size={18} aria-hidden="true" />
                            My dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="header-dropdown-link">
                          <Link to="/dashboard?section=plans">
                            <Package size={18} aria-hidden="true" />
                            Shipment plans
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="header-dropdown-link">
                          <Link to="/dashboard?section=addresses">
                            <MapPin size={18} aria-hidden="true" />
                            Address book
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="header-dropdown-link">
                          <Link to="/dashboard?section=profile">
                            <UserCircle size={18} aria-hidden="true" />
                            Profile &amp; access
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem
                      className="header-dropdown-link"
                      onSelect={() => {
                        void signOut();
                        navigate('/', { replace: true });
                      }}
                    >
                      <LogOut size={18} aria-hidden="true" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Link to="/login" className="header-account" aria-label="Sign in to your account">
                <span>Sign In</span>
                <UserCircle size={26} strokeWidth={1.25} aria-hidden="true" />
              </Link>
            )}

            <Dialog
              open={searchOpen}
              onOpenChange={(open) => {
                setSearchOpen(open);
                if (!open) setSearchQuery('');
              }}
            >
              <DialogTrigger asChild>
                <button type="button" className="header-icon-button" aria-label="Search this site">
                  <Search size={26} strokeWidth={1.25} aria-hidden="true" />
                </button>
              </DialogTrigger>
              <DialogContent className="site-search-dialog">
                <DialogTitle className="site-search-title">How can we help you?</DialogTitle>
                <DialogDescription>
                  Search shipping, tracking, locations, and more.
                </DialogDescription>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (searchResults.length > 0) {
                      navigate(searchResults[0].href);
                      closeSearch();
                    }
                  }}
                  className="site-search-form"
                >
                  <label className="sr-only" htmlFor="site-search">
                    Search this site
                  </label>
                  <Search size={21} aria-hidden="true" />
                  <input
                    id="site-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="What are you looking for?"
                    autoComplete="off"
                  />
                </form>
                <p className="search-results-label" aria-live="polite">
                  {query ? `${searchResults.length} results` : 'Popular pages'}
                </p>
                <ul className="site-search-results">
                  {searchResults.map((page) => (
                    <li key={page.href}>
                      <Link to={page.href} onClick={closeSearch}>
                        <span>
                          <strong>{page.label}</strong>
                          <small>{page.description}</small>
                        </span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {searchResults.length === 0 && (
                  <p className="search-empty">
                    No matching pages. Try “tracking,” “shipping,” or “locations.”
                  </p>
                )}
              </DialogContent>
            </Dialog>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="header-icon-button mobile-menu-trigger"
                  aria-label="Open menu"
                >
                  <Menu size={26} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="mobile-navigation-sheet">
                <SheetTitle className="sr-only">Main menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Shipping, tracking, and account navigation.
                </SheetDescription>
                <Link
                  to="/"
                  className="brand-logo"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="FedEx home"
                >
                  <BrandImage image={siteImages.logo} priority />
                </Link>
                <nav aria-label="Mobile navigation">
                  {navigation.map((item) => (
                    <Link key={item.key} to={item.href} onClick={() => setMobileMenuOpen(false)}>
                      {t(`nav.${item.key}`, item.label)}
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  ))}
                </nav>
                <div className="mobile-quick-links">
                  <Link to="/store" onClick={() => setMobileMenuOpen(false)}>
                    Shipping supplies
                  </Link>
                  <Link to="/returns" onClick={() => setMobileMenuOpen(false)}>
                    Return a package
                  </Link>
                  <Link to="/rate-calculator" onClick={() => setMobileMenuOpen(false)}>
                    Get a quote
                  </Link>
                  {user ? (
                    <>
                      <Link
                        to={user.role === 'admin' ? '/admin' : '/dashboard'}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <LayoutDashboard size={21} aria-hidden="true" />
                        {user.role === 'admin' ? 'Admin dashboard' : 'My account'}
                      </Link>
                      <button
                        type="button"
                        className="mobile-sign-out"
                        onClick={() => {
                          void signOut();
                          setMobileMenuOpen(false);
                          navigate('/', { replace: true });
                        }}
                      >
                        <LogOut size={21} aria-hidden="true" />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      <UserCircle size={21} aria-hidden="true" />
                      Sign in
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
