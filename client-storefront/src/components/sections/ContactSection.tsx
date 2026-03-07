import { useState, type FormEvent } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import type { StoreSection } from '@/lib/api';
import { submitContact } from '@/lib/api';

interface Props {
  section: StoreSection;
  slug: string;
}

export function ContactSection({ section, slug }: Props) {
  const c = section.content as {
    title?: string;
    subtitle?: string;
    showPhone?: boolean;
    showEmail?: boolean;
  };

  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setStatus('sending');
    try {
      await submitContact(slug, form.name, form.email, form.message);
      setStatus('sent');
      setForm({ name: '', email: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="store-section">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'var(--color-primary)' }}>
            {c.title || section.title || 'Get in Touch'}
          </h2>
          {c.subtitle && <p className="text-gray-500">{c.subtitle}</p>}
        </div>

        {status === 'sent' ? (
          <div className="reveal text-center py-12 bg-gray-50 rounded-2xl">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--color-primary-light)' }}
            >
              <CheckCircle className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
            <p className="text-gray-500">Thank you for reaching out. We'll get back to you soon.</p>
            <button onClick={() => setStatus('idle')} className="btn-secondary mt-6">
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="reveal space-y-4">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium mb-1.5">Name</label>
              <input
                id="contact-name"
                type="text"
                className="store-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium mb-1.5">Email</label>
              <input
                id="contact-email"
                type="email"
                className="store-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium mb-1.5">Message</label>
              <textarea
                id="contact-message"
                className="store-input min-h-[120px] resize-y"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
              />
            </div>
            {status === 'error' && (
              <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
            )}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending...' : (
                <>
                  <Send className="h-4 w-4" /> Send Message
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
