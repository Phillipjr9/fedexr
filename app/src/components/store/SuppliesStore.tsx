import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Trash2, Package, Search, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  minOrder: number;
}

interface CartItem extends Product {
  quantity: number;
}

const products: Product[] = [
  { id: '1', name: 'FedEx Small Box', description: '11.5" x 2.375" x 13.25"', price: 0.00, image: '/images/sustainability.jpg', category: 'boxes', minOrder: 25 },
  { id: '2', name: 'FedEx Medium Box', description: '13.25" x 11.5" x 2.375"', price: 0.00, image: '/images/sustainability.jpg', category: 'boxes', minOrder: 25 },
  { id: '3', name: 'FedEx Large Box', description: '12.375" x 17.5" x 3"', price: 0.00, image: '/images/sustainability.jpg', category: 'boxes', minOrder: 25 },
  { id: '4', name: 'FedEx Extra Large Box', description: '11.875" x 10.75" x 11"', price: 0.00, image: '/images/sustainability.jpg', category: 'boxes', minOrder: 25 },
  { id: '5', name: 'FedEx Envelope', description: '9.5" x 12.5"', price: 0.00, image: '/images/hero-shipping.jpg', category: 'envelopes', minOrder: 100 },
  { id: '6', name: 'FedEx Pak', description: '12" x 15.5"', price: 0.00, image: '/images/hero-shipping.jpg', category: 'envelopes', minOrder: 50 },
  { id: '7', name: 'Packing Tape', description: '2" x 55 yards, Clear', price: 4.99, image: '/images/sustainability.jpg', category: 'supplies', minOrder: 1 },
  { id: '8', name: 'Bubble Wrap', description: '12" x 30 ft roll', price: 12.99, image: '/images/sustainability.jpg', category: 'supplies', minOrder: 1 },
  { id: '9', name: 'Packing Peanuts', description: '3.5 cubic ft bag', price: 15.99, image: '/images/sustainability.jpg', category: 'supplies', minOrder: 1 },
  { id: '10', name: 'Shipping Labels', description: '8.5" x 11", 100 sheets', price: 24.99, image: '/images/hero-shipping.jpg', category: 'labels', minOrder: 1 },
  { id: '11', name: 'Thermal Labels', description: '4" x 6", 250 labels', price: 19.99, image: '/images/hero-shipping.jpg', category: 'labels', minOrder: 1 },
  { id: '12', name: 'Document Pouch', description: '5.5" x 10", Pack of 100', price: 9.99, image: '/images/hero-shipping.jpg', category: 'labels', minOrder: 1 },
];

const categories = [
  { id: 'all', name: 'All Products' },
  { id: 'boxes', name: 'Boxes' },
  { id: 'envelopes', name: 'Envelopes & Paks' },
  { id: 'supplies', name: 'Packing Supplies' },
  { id: 'labels', name: 'Labels & Pouches' },
];

export default function SuppliesStore() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckout, setIsCheckout] = useState(false);

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + product.minOrder } : item
        );
      }
      return [...prev, { ...product, quantity: product.minOrder }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(item.minOrder, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    setIsCheckout(true);
    setTimeout(() => {
      toast.success('Order placed successfully!');
      setCart([]);
      setIsCheckout(false);
      setIsCartOpen(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-fedex-gray">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Packaging Supplies Store</h1>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 bg-fedex-purple text-white rounded-lg hover:bg-fedex-purple-dark transition-colors"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-fedex-orange text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-fedex-purple text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="h-48 bg-gray-100 flex items-center justify-center">
                <Package className="h-16 w-16 text-gray-300" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-fedex-purple">
                      {product.price === 0 ? 'FREE' : `$${product.price.toFixed(2)}`}
                    </p>
                    <p className="text-xs text-gray-400">Min. order: {product.minOrder}</p>
                  </div>
                  <Button
                    onClick={() => addToCart(product)}
                    className="bg-fedex-purple hover:bg-fedex-purple-dark"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Shopping Cart</h2>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Your cart is empty</p>
                    <Button
                      onClick={() => setIsCartOpen(false)}
                      className="mt-4 bg-fedex-purple hover:bg-fedex-purple-dark"
                    >
                      Continue Shopping
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-6">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                          <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                            <Package className="h-8 w-8 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                            <p className="text-sm text-gray-500">{item.description}</p>
                            <p className="text-fedex-purple font-medium">
                              {item.price === 0 ? 'FREE' : `$${item.price.toFixed(2)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -item.minOrder)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-12 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.minOrder)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="p-1 hover:bg-red-100 text-red-500 rounded ml-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Shipping</span>
                        <span className="font-medium">FREE</span>
                      </div>
                      <div className="flex justify-between text-lg font-semibold mb-4">
                        <span>Total</span>
                        <span className="text-fedex-purple">${cartTotal.toFixed(2)}</span>
                      </div>
                      <Button
                        onClick={handleCheckout}
                        disabled={isCheckout}
                        className="w-full bg-fedex-orange hover:bg-fedex-orange-dark"
                      >
                        {isCheckout ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          />
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Checkout
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
