import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, Camera, CheckCircle, ChevronRight, ArrowLeft, Truck, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ReturnRequest {
  trackingNumber: string;
  reason: string;
  condition: string;
  photos: string[];
  refundMethod: string;
}

const returnReasons = [
  { id: 'damaged', label: 'Item arrived damaged', description: 'The package or item was damaged during shipping' },
  { id: 'wrong', label: 'Wrong item received', description: 'I received a different item than what I ordered' },
  { id: 'missing', label: 'Item missing from package', description: 'The package arrived but the item was not inside' },
  { id: 'late', label: 'Package arrived late', description: 'The delivery was delayed beyond the promised date' },
  { id: 'other', label: 'Other reason', description: 'Please provide details in the comments' },
];

const conditions = [
  { id: 'unopened', label: 'Unopened', description: 'Package has not been opened' },
  { id: 'opened', label: 'Opened but unused', description: 'Package opened but item not used' },
  { id: 'used', label: 'Used', description: 'Item has been used' },
  { id: 'damaged', label: 'Damaged', description: 'Item or package is damaged' },
];

const refundMethods = [
  { id: 'original', label: 'Original Payment Method', description: 'Refund to the card used for purchase' },
  { id: 'credit', label: 'FedEx Account Credit', description: 'Credit applied to your FedEx account' },
];

export default function ReturnsPortal() {
  const [step, setStep] = useState(1);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [returnData, setReturnData] = useState<Partial<ReturnRequest>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.success('Return request submitted successfully!');
    setIsSubmitting(false);
    setStep(5);
  };

  return (
    <div className="min-h-screen bg-fedex-gray py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Returns & Claims</h1>
          <p className="text-gray-600">File a return or claim for your shipment</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Find Package' },
              { num: 2, label: 'Reason' },
              { num: 3, label: 'Details' },
              { num: 4, label: 'Submit' },
              { num: 5, label: 'Confirmation' },
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-1 ${
                  step >= s.num ? 'bg-fedex-purple text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.num ? <CheckCircle className="h-4 w-4" /> : s.num}
                </div>
                <span className={`text-xs ${step >= s.num ? 'text-fedex-purple' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-200 rounded-full mt-4">
            <motion.div
              className="h-full bg-fedex-purple rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((step - 1) / 4) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-lg shadow-lg p-8"
          >
            {/* Step 1: Find Package */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Find Your Package</h2>
                <p className="text-gray-600 mb-6">Enter the tracking number of the package you want to return or file a claim for.</p>
                <form onSubmit={handleSearch}>
                  <div className="flex gap-4">
                    <div className="flex-1 relative">
                      <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Enter tracking number"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button type="submit" className="bg-fedex-purple hover:bg-fedex-purple-dark">
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </Button>
                  </div>
                </form>

                <div className="mt-8 p-4 bg-fedex-gray rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Need help finding your tracking number?</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Check your shipping confirmation email</li>
                    <li>• Look at your shipping receipt</li>
                    <li>• Check your FedEx account order history</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 2: Select Reason */}
            {step === 2 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Why are you returning this?</h2>
                <div className="space-y-3">
                  {returnReasons.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => {
                        setReturnData(prev => ({ ...prev, reason: reason.id }));
                        setStep(3);
                      }}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                        returnData.reason === reason.id
                          ? 'border-fedex-purple bg-fedex-purple/5'
                          : 'border-gray-200 hover:border-fedex-purple/50'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{reason.label}</p>
                      <p className="text-sm text-gray-500">{reason.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Package Condition & Photos */}
            {step === 3 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Package Details</h2>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">What is the condition of the package/item?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {conditions.map((condition) => (
                      <button
                        key={condition.id}
                        onClick={() => setReturnData(prev => ({ ...prev, condition: condition.id }))}
                        className={`p-3 border-2 rounded-lg text-left transition-colors ${
                          returnData.condition === condition.id
                            ? 'border-fedex-purple bg-fedex-purple/5'
                            : 'border-gray-200 hover:border-fedex-purple/50'
                        }`}
                      >
                        <p className="font-medium text-gray-900">{condition.label}</p>
                        <p className="text-xs text-gray-500">{condition.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Photos (optional but recommended)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-fedex-purple transition-colors cursor-pointer">
                    <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Click to upload or drag and drop</p>
                    <p className="text-sm text-gray-400">PNG, JPG up to 10MB each</p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(4)}
                    disabled={!returnData.condition}
                    className="bg-fedex-purple hover:bg-fedex-purple-dark"
                  >
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Refund Method & Submit */}
            {step === 4 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Refund Method</h2>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">How would you like to receive your refund?</label>
                  <div className="space-y-3">
                    {refundMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setReturnData(prev => ({ ...prev, refundMethod: method.id }))}
                        className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                          returnData.refundMethod === method.id
                            ? 'border-fedex-purple bg-fedex-purple/5'
                            : 'border-gray-200 hover:border-fedex-purple/50'
                        }`}
                      >
                        <div className="flex items-center">
                          {method.id === 'original' ? <DollarSign className="h-5 w-5 text-fedex-purple mr-3" /> : <FileText className="h-5 w-5 text-fedex-purple mr-3" />}
                          <div>
                            <p className="font-medium text-gray-900">{method.label}</p>
                            <p className="text-sm text-gray-500">{method.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-fedex-gray rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-2">Return Summary</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Tracking:</strong> {trackingNumber}</p>
                    <p><strong>Reason:</strong> {returnReasons.find(r => r.id === returnData.reason)?.label}</p>
                    <p><strong>Condition:</strong> {conditions.find(c => c.id === returnData.condition)?.label}</p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!returnData.refundMethod || isSubmitting}
                    className="bg-fedex-orange hover:bg-fedex-orange-dark"
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Submit Return Request
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Confirmation */}
            {step === 5 && (
              <div className="text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Return Request Submitted!</h2>
                <p className="text-gray-600 mb-6">
                  Your return request has been received. We&apos;ll send you a confirmation email with next steps.
                </p>
                <div className="bg-fedex-gray rounded-lg p-4 mb-6 text-left">
                  <p className="text-sm text-gray-600"><strong>Return ID:</strong> RET-{Date.now().toString().slice(-8)}</p>
                  <p className="text-sm text-gray-600"><strong>Tracking:</strong> {trackingNumber}</p>
                  <p className="text-sm text-gray-600"><strong>Expected Resolution:</strong> 5-7 business days</p>
                </div>
                <div className="flex justify-center gap-4">
                  <Button onClick={() => {
                    setStep(1);
                    setTrackingNumber('');
                    setReturnData({});
                  }} className="bg-fedex-purple hover:bg-fedex-purple-dark">
                    Start New Return
                  </Button>
                  <Button variant="outline">
                    <Truck className="mr-2 h-4 w-4" />
                    Track Status
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
