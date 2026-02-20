'use client';

import { useState, type FormEvent } from 'react';
import { Mail, Send, CheckCircle } from 'lucide-react';

const subjects = ['General', 'Support', 'Partnership', 'Press'] as const;

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<string>(subjects[0]);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required.';
    if (!email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!message.trim()) newErrors.message = 'Message is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validate()) {
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="pb-4 pt-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]">
            Contact
          </p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Get in Touch
          </h1>
          <p className="mt-4 text-lg text-[var(--bmn-color-text-secondary)]">
            Have a question, feedback, or partnership idea? We&apos;d love to
            hear from you.
          </p>
        </div>
      </section>

      <section className="pb-20 pt-8">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 md:grid-cols-5 lg:px-8">
          {/* Form */}
          <div className="md:col-span-3">
            {submitted ? (
              <div className="flex flex-col items-center rounded-2xl border border-[var(--bmn-color-success)]/30 bg-[var(--bmn-color-success-bg)] p-10 text-center">
                <CheckCircle
                  size={48}
                  className="text-[var(--bmn-color-success)]"
                />
                <h2
                  className="mt-4 text-xl font-bold"
                  style={{ fontFamily: 'var(--bmn-font-secondary)' }}
                >
                  Message sent!
                </h2>
                <p className="mt-2 text-sm text-[var(--bmn-color-text-secondary)]">
                  We&apos;ll get back to you within 24 hours.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="space-y-5 rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-6 sm:p-8"
              >
                {/* Name */}
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-[var(--bmn-color-border)] bg-[var(--bmn-color-background)] px-4 py-2.5 text-sm text-[var(--bmn-color-text)] placeholder-[var(--bmn-color-text-muted)] outline-none transition-colors focus:border-[var(--bmn-color-border-focus)]"
                    placeholder="Your name"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-[var(--bmn-color-error)]">
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-[var(--bmn-color-border)] bg-[var(--bmn-color-background)] px-4 py-2.5 text-sm text-[var(--bmn-color-text)] placeholder-[var(--bmn-color-text-muted)] outline-none transition-colors focus:border-[var(--bmn-color-border-focus)]"
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-[var(--bmn-color-error)]">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label
                    htmlFor="subject"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Subject
                  </label>
                  <select
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-[var(--bmn-color-border)] bg-[var(--bmn-color-background)] px-4 py-2.5 text-sm text-[var(--bmn-color-text)] outline-none transition-colors focus:border-[var(--bmn-color-border-focus)]"
                  >
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="message"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full resize-none rounded-lg border border-[var(--bmn-color-border)] bg-[var(--bmn-color-background)] px-4 py-2.5 text-sm text-[var(--bmn-color-text)] placeholder-[var(--bmn-color-text-muted)] outline-none transition-colors focus:border-[var(--bmn-color-border-focus)]"
                    placeholder="How can we help?"
                  />
                  {errors.message && (
                    <p className="mt-1 text-xs text-[var(--bmn-color-error)]">
                      {errors.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--bmn-color-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--bmn-color-accent-foreground)] transition-all hover:bg-[var(--bmn-color-accent-hover)] hover:shadow-md"
                >
                  <Send size={16} />
                  Send Message
                </button>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6 md:col-span-2">
            {/* Email contacts */}
            <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-6">
              <h3
                className="mb-4 text-lg font-semibold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                Other Ways to Reach Us
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail
                    size={18}
                    className="mt-0.5 shrink-0 text-[var(--bmn-color-accent)]"
                  />
                  <div>
                    <p className="text-sm font-medium">General Support</p>
                    <a
                      href="mailto:support@brandmenow.com"
                      className="text-sm text-[var(--bmn-color-text-secondary)] underline underline-offset-2 hover:text-[var(--bmn-color-text)]"
                    >
                      support@brandmenow.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail
                    size={18}
                    className="mt-0.5 shrink-0 text-[var(--bmn-color-accent)]"
                  />
                  <div>
                    <p className="text-sm font-medium">Partnerships</p>
                    <a
                      href="mailto:partnerships@brandmenow.com"
                      className="text-sm text-[var(--bmn-color-text-secondary)] underline underline-offset-2 hover:text-[var(--bmn-color-text)]"
                    >
                      partnerships@brandmenow.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Social */}
            <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-6">
              <h3
                className="mb-4 text-lg font-semibold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                Follow Us
              </h3>
              <div className="space-y-2">
                <a
                  href="https://twitter.com/brandmenow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-[var(--bmn-color-text-secondary)] underline underline-offset-2 hover:text-[var(--bmn-color-text)]"
                >
                  Twitter / X
                </a>
                <a
                  href="https://instagram.com/brandmenow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-[var(--bmn-color-text-secondary)] underline underline-offset-2 hover:text-[var(--bmn-color-text)]"
                >
                  Instagram
                </a>
              </div>
            </div>

            {/* FAQ link */}
            <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-6">
              <p className="text-sm text-[var(--bmn-color-text-secondary)]">
                Looking for quick answers?{' '}
                <a
                  href="/#faq"
                  className="font-medium text-[var(--bmn-color-accent)] underline underline-offset-2 hover:text-[var(--bmn-color-accent-hover)]"
                >
                  Check our FAQ
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
