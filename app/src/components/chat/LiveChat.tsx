import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, Minimize2, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OPEN_ASSISTANT_EVENT } from '@/lib/chat';

interface MessageLink {
  label: string;
  href: string;
}

interface Message {
  id: string;
  text: string;
  links?: MessageLink[];
  sender: 'user' | 'bot';
  timestamp: Date;
}

function initialMessages(): Message[] {
  return [{
    id: 'welcome',
    text: 'Hello! This is an automated shipping guide. I can point you to tracking, shipping, locations, and print tools. Please do not enter account, payment, or personal information.',
    sender: 'bot', timestamp: new Date(),
  }];
}

const quickReplies = ['Track my package', 'Shipping rates', 'Schedule a pickup', 'Find a location', 'File a claim', 'Talk to an agent'];

const responses: { keys: string[]; text: string; links: MessageLink[] }[] = [
  {
    keys: ['agent', 'human', 'representative'],
    text: 'No live agents are connected to this assistant.',
    links: [{ label: 'Contact FedEx support', href: 'https://www.fedex.com/en-us/customer-support.html' }],
  },
  {
    keys: ['claim', 'damage', 'lost'],
    text: 'Damaged or lost shipments are handled through the claims page, which explains eligibility, required documents, and deadlines.',
    links: [{ label: 'FedEx claims', href: 'https://www.fedex.com/en-us/customer-support/claims.html' }],
  },
  {
    keys: ['track', 'package status'],
    text: 'Enter the tracking number on the tracking page to see the updates recorded for that shipment.',
    links: [{ label: 'View tracking', href: '/tracking' }],
  },
  {
    keys: ['rate', 'quote', 'cost', 'price'],
    text: 'Compare estimates in the rate calculator. Prices and delivery dates are not guaranteed.',
    links: [{ label: 'Open the rate calculator', href: '/rate-calculator' }, { label: 'Get a FedEx quote', href: 'https://www.fedex.com/en-us/online/rating.html' }],
  },
  {
    keys: ['pickup', 'pick up', 'collection'],
    text: 'Prepare a pickup plan here, then complete the reservation on fedex.com. No pickup or driver is booked here.',
    links: [{ label: 'Prepare a pickup plan', href: '/shipping/pickup' }],
  },
  {
    keys: ['location', 'store', 'nearby', 'zip'],
    text: 'Our locations page contains verified New York examples, not live nearest-location results. The FedEx locator covers other areas and current services.',
    links: [{ label: 'Browse saved New York locations', href: '/locations' }, { label: 'Open the FedEx locator', href: 'https://local.fedex.com/en/search' }],
  },
  {
    keys: ['print', 'design', 'poster', 'business card'],
    text: 'Choose a product and prepare a local print brief. Files are not uploaded, and no order is placed until you use the FedEx Office website.',
    links: [{ label: 'Prepare a print project', href: '/design-print' }],
  },
];

export default function LiveChat() {
  const reducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, open);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, open);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, isOpen]);

  function close(reset = false) {
    setIsOpen(false);
    if (reset) { setMessages(initialMessages()); setInputValue(''); }
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const match = responses.find((response) => response.keys.some((key) => trimmed.toLowerCase().includes(key)));
    setMessages((previous) => [...previous, {
      id: `user-${++sequence.current}`, text: trimmed, sender: 'user', timestamp: new Date(),
    }, {
      id: `bot-${++sequence.current}`,
      text: match?.text || 'This automated guide can point you to shipping, tracking, locations, and print tools. Browse our help articles or contact FedEx support.',
      links: match?.links || [{ label: 'Browse help articles', href: '/support' }],
      sender: 'bot', timestamp: new Date(),
    }]);
    setInputValue('');
    inputRef.current?.focus();
  }

  return (
    <>
      <AnimatePresence>
        {!isOpen && <motion.button ref={triggerRef} initial={reducedMotion ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={reducedMotion ? { opacity: 1 } : { scale: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} onClick={() => setIsOpen(true)} aria-label="Open chat" className="fixed bottom-6 right-6 w-14 h-14 bg-fedex-purple text-white rounded-full shadow-lg hover:bg-fedex-purple-dark transition-colors z-50 flex items-center justify-center"><MessageCircle className="h-6 w-6" aria-hidden="true" /></motion.button>}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.95 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} role="dialog" aria-labelledby="shipping-assistant-title" aria-modal={false} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }} className="assistant-window fixed bottom-6 right-6 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="bg-fedex-purple p-4 flex items-center justify-between">
              <div className="flex items-center"><div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3"><Bot className="h-6 w-6 text-white" aria-hidden="true" /></div><div><h3 id="shipping-assistant-title" className="text-white font-semibold">Shipping Assistant</h3><p className="text-white/80 text-sm">Automated guide</p></div></div>
              <div className="flex items-center gap-2"><button onClick={() => close()} aria-label="Minimize chat" className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><Minimize2 className="h-5 w-5" aria-hidden="true" /></button><button onClick={() => close(true)} aria-label="Close chat" className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5" aria-hidden="true" /></button></div>
            </div>
            <div className="h-96 overflow-y-auto p-4 bg-gray-50" role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions">
              {messages.map((message) => <div key={message.id} className={`flex mb-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[90%] p-3 rounded-2xl ${message.sender === 'user' ? 'bg-fedex-purple text-white rounded-br-none' : 'bg-white shadow-sm rounded-bl-none'}`}><p className="text-sm">{message.text}</p>{message.links && <div className="flex flex-col gap-3 mt-3">{message.links.map((link) => link.href.startsWith('/') ? <Link key={link.href} to={link.href} onClick={() => close()} className="text-sm text-[#0073ad] underline font-medium">{link.label}</Link> : <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0073ad] underline font-medium">{link.label} <ArrowUpRight size={13} className="inline" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>)}</div>}<p className={`text-xs mt-2 ${message.sender === 'user' ? 'text-white/80' : 'text-gray-600'}`}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div>)}
              {messages.length < 3 && <div className="flex flex-wrap gap-2 mt-4">{quickReplies.map((reply) => <button key={reply} onClick={() => send(reply)} className="px-3 py-2 bg-white border border-fedex-purple text-fedex-purple text-sm rounded-full hover:bg-fedex-purple hover:text-white transition-colors">{reply}</button>)}</div>}
              <div ref={messagesEndRef} />
            </div>
            <form className="p-4 bg-white border-t" onSubmit={(event) => { event.preventDefault(); send(inputValue); }}>
              <div className="flex gap-2"><Input ref={inputRef} value={inputValue} onChange={(event) => setInputValue(event.target.value)} maxLength={500} placeholder="Type your message..." aria-label="Chat message" className="flex-1" /><Button type="submit" aria-label="Send message" className="bg-fedex-purple hover:bg-fedex-purple-dark"><Send className="h-4 w-4" aria-hidden="true" /></Button></div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
