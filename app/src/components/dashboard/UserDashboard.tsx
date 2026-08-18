import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, MapPin, CreditCard, Gift, Truck, CheckCircle, ChevronRight, Star, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const tabs = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'shipments', label: 'Shipments', icon: Package },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'rewards', label: 'Rewards', icon: Gift },
];

const recentShipments = [
  { id: '784512369874', status: 'Delivered', date: 'Apr 2, 2026', to: 'John Smith', tracking: '784512369874' },
  { id: '987654321456', status: 'In Transit', date: 'Apr 1, 2026', to: 'Jane Doe', tracking: '987654321456' },
  { id: '456789123456', status: 'Delivered', date: 'Mar 28, 2026', to: 'Bob Johnson', tracking: '456789123456' },
  { id: '789123456789', status: 'Delivered', date: 'Mar 25, 2026', to: 'Alice Williams', tracking: '789123456789' },
];

const savedAddresses = [
  { id: 1, name: 'Home', street: '123 Main St', city: 'New York', state: 'NY', zip: '10001', default: true },
  { id: 2, name: 'Office', street: '456 Broadway', city: 'New York', state: 'NY', zip: '10013', default: false },
];

const paymentMethods = [
  { id: 1, type: 'visa', last4: '4242', expiry: '12/27', default: true },
  { id: 2, type: 'mastercard', last4: '8888', expiry: '08/26', default: false },
];

export default function UserDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const userName = typeof window !== 'undefined' ? (localStorage.getItem('userName') || 'Member') : 'Member';

  return (
    <div className="min-h-screen bg-fedex-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-fedex-purple rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4">
                JD
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Welcome back, {userName}!</h1>
                <p className="text-gray-500">Member since 2023</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">FedEx Rewards Points</p>
              <p className="text-3xl font-bold text-fedex-purple">2,450</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-fedex-purple text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-3" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Package className="h-8 w-8 text-fedex-purple" />
                        <span className="text-sm text-green-600 font-medium">+12%</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">24</p>
                      <p className="text-gray-500">Shipments this month</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Truck className="h-8 w-8 text-fedex-orange" />
                        <span className="text-sm text-green-600 font-medium">+5%</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">$1,245</p>
                      <p className="text-gray-500">Shipping spent</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Gift className="h-8 w-8 text-fedex-purple" />
                        <span className="text-sm text-green-600 font-medium">+250</span>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">2,450</p>
                      <p className="text-gray-500">Reward points</p>
                    </div>
                  </div>

                  {/* Recent Shipments */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Recent Shipments</h2>
                      <button
                        onClick={() => setActiveTab('shipments')}
                        className="text-fedex-link hover:text-fedex-link-dark text-sm"
                      >
                        View All
                      </button>
                    </div>
                    <div className="space-y-3">
                      {recentShipments.slice(0, 3).map((shipment) => (
                        <div key={shipment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                              shipment.status === 'Delivered' ? 'bg-green-100' : 'bg-blue-100'
                            }`}>
                              {shipment.status === 'Delivered' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <Truck className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">To: {shipment.to}</p>
                              <p className="text-sm text-gray-500">{shipment.date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              shipment.status === 'Delivered'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {shipment.status}
                            </span>
                            <p className="text-sm text-gray-500 mt-1">{shipment.tracking}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                      <Link to="/shipping/create">
                        <Button className="w-full bg-fedex-purple hover:bg-fedex-purple-dark">
                          <Package className="mr-2 h-4 w-4" />
                          Create Shipment
                        </Button>
                      </Link>
                      <Link to="/tracking">
                        <Button variant="outline" className="w-full border-fedex-purple text-fedex-purple hover:bg-fedex-purple/10">
                          <Truck className="mr-2 h-4 w-4" />
                          Track Package
                        </Button>
                      </Link>
                      <Link to="/rate-calculator">
                        <Button variant="outline" className="w-full border-fedex-purple text-fedex-purple hover:bg-fedex-purple/10">
                          <CreditCard className="mr-2 h-4 w-4" />
                          Get Quote
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Shipments Tab */}
              {activeTab === 'shipments' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">All Shipments</h2>
                  <div className="space-y-3">
                    {recentShipments.map((shipment) => (
                      <div key={shipment.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-fedex-purple transition-colors">
                        <div className="flex items-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                            shipment.status === 'Delivered' ? 'bg-green-100' : 'bg-blue-100'
                          }`}>
                            {shipment.status === 'Delivered' ? (
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            ) : (
                              <Truck className="h-6 w-6 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Tracking: {shipment.tracking}</p>
                            <p className="text-sm text-gray-500">To: {shipment.to}</p>
                            <p className="text-sm text-gray-400">{shipment.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium mr-4 ${
                            shipment.status === 'Delivered'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {shipment.status}
                          </span>
                          <Link to={`/tracking?number=${shipment.tracking}`}>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Addresses Tab */}
              {activeTab === 'addresses' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Saved Addresses</h2>
                    <Button className="bg-fedex-purple hover:bg-fedex-purple-dark">
                      <MapPin className="mr-2 h-4 w-4" />
                      Add Address
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {savedAddresses.map((address) => (
                      <div key={address.id} className="border border-gray-200 rounded-lg p-4 relative">
                        {address.default && (
                          <span className="absolute top-2 right-2 px-2 py-1 bg-fedex-purple text-white text-xs rounded">
                            Default
                          </span>
                        )}
                        <p className="font-semibold text-gray-900">{address.name}</p>
                        <p className="text-gray-600">{address.street}</p>
                        <p className="text-gray-600">{address.city}, {address.state} {address.zip}</p>
                        <div className="mt-3 flex gap-2">
                          <Button variant="outline" size="sm">Edit</Button>
                          {!address.default && (
                            <Button variant="outline" size="sm">Set Default</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Tab */}
              {activeTab === 'payment' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Payment Methods</h2>
                    <Button className="bg-fedex-purple hover:bg-fedex-purple-dark">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Add Card
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {paymentMethods.map((card) => (
                      <div key={card.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-12 h-8 bg-gray-200 rounded mr-4 flex items-center justify-center">
                            <span className="text-xs font-bold uppercase">{card.type}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">•••• {card.last4}</p>
                            <p className="text-sm text-gray-500">Expires {card.expiry}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {card.default && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                              Default
                            </span>
                          )}
                          <Button variant="outline" size="sm">Edit</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rewards Tab */}
              {activeTab === 'rewards' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-fedex-purple to-fedex-purple-dark rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/80 mb-1">Your Points</p>
                        <p className="text-5xl font-bold">2,450</p>
                        <p className="text-white/80 mt-2">550 points until your next $25 reward</p>
                      </div>
                      <Gift className="h-20 w-20 text-white/30" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Rewards</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                      {[
                        { points: 3000, value: '$25' },
                        { points: 5000, value: '$50' },
                        { points: 10000, value: '$100' },
                      ].map((reward) => (
                        <div key={reward.points} className="border border-gray-200 rounded-lg p-4 text-center">
                          <Star className="h-8 w-8 text-fedex-orange mx-auto mb-2" />
                          <p className="text-2xl font-bold text-gray-900">{reward.value}</p>
                          <p className="text-sm text-gray-500">{reward.points.toLocaleString()} points</p>
                          <Button
                            variant="outline"
                            className="w-full mt-3"
                            disabled={2450 < reward.points}
                          >
                            {2450 >= reward.points ? 'Redeem' : 'Locked'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Earn Points</h2>
                    <div className="space-y-3">
                      {[
                        { action: 'Create a shipment', points: '+50 points' },
                        { action: 'Refer a friend', points: '+200 points' },
                        { action: 'Complete your profile', points: '+100 points' },
                        { action: 'Ship internationally', points: '+150 points' },
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">{item.action}</span>
                          <span className="text-fedex-purple font-medium">{item.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
