import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Brand Me Now privacy policy. Learn how we collect, use, and protect your data when you use our AI-powered brand creation platform.',
  openGraph: {
    title: 'Privacy Policy | Brand Me Now',
    description: 'How Brand Me Now collects, uses, and protects your data.',
    url: 'https://brandmenow.com/privacy',
    images: [{ url: '/og/default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy | Brand Me Now',
    description: 'How Brand Me Now collects, uses, and protects your data.',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="pb-4 pt-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-[var(--bmn-color-text-muted)]">
            Last updated: February 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20 pt-8">
        <div className="prose-bmn mx-auto max-w-[800px] px-4 sm:px-6">
          <div className="space-y-10">
            {/* Intro */}
            <p className="text-[var(--bmn-color-text-secondary)] leading-relaxed">
              Brand Me Now (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
              is committed to protecting your privacy. This policy describes how
              we collect, use, and share information when you use our AI-powered
              brand creation platform at brandmenow.com (the
              &quot;Service&quot;).
            </p>

            {/* 1. Information We Collect */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                1. Information We Collect
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Account Information:
                  </strong>{' '}
                  When you create an account, we collect your name, email
                  address, and authentication credentials managed through
                  Supabase Auth. We do not store raw passwords.
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Social Media Handles:
                  </strong>{' '}
                  You may provide your social media usernames so our AI can
                  analyze your publicly available content. We access only public
                  data through official APIs.
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Brand Assets:
                  </strong>{' '}
                  Content you create using the Service, including brand
                  identities, logos, product mockups, and associated
                  configurations.
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Usage Analytics:
                  </strong>{' '}
                  We collect anonymized usage data including pages visited,
                  features used, and session duration via PostHog.
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Payment Information:
                  </strong>{' '}
                  Payment details are collected and processed directly by Stripe.
                  We do not store credit card numbers on our servers.
                </p>
              </div>
            </div>

            {/* 2. How We Use Your Information */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                2. How We Use Your Information
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <li>
                  To provide and operate the Service, including generating brand
                  identities, logos, and product mockups.
                </li>
                <li>
                  To analyze your publicly available social media content for
                  brand generation purposes.
                </li>
                <li>
                  To improve our AI models and Service quality using anonymized,
                  aggregated data.
                </li>
                <li>
                  To communicate with you about your account, including
                  transactional emails and service updates.
                </li>
                <li>
                  To detect, prevent, and address security issues and abuse.
                </li>
              </ul>
            </div>

            {/* 3. AI and Your Data */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                3. AI and Your Data
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>
                  Our Service uses multiple AI models to generate brand assets.
                  Here is how your data is handled in the AI pipeline:
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Social media analysis:
                  </strong>{' '}
                  We access only publicly available content through official
                  platform APIs. We do not store your social media credentials or
                  access private content.
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    AI processing:
                  </strong>{' '}
                  Your content is sent to AI providers (Anthropic, Google,
                  OpenAI) for processing. These providers process data according
                  to their API terms, which prohibit using API inputs to train
                  their models.
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Generated assets:
                  </strong>{' '}
                  All brand assets generated for you (logos, identities,
                  mockups) are yours to keep and use. We do not claim ownership
                  of your generated content.
                </p>
              </div>
            </div>

            {/* 4. Data Sharing */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                4. Data Sharing
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>
                  We do not sell your personal data. We share data only with the
                  following service providers, who process it on our behalf:
                </p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Stripe
                    </strong>{' '}
                    -- payment processing
                  </li>
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Supabase
                    </strong>{' '}
                    -- database hosting and authentication
                  </li>
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Anthropic, Google, OpenAI
                    </strong>{' '}
                    -- AI model processing (data is not used to train their
                    models)
                  </li>
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      PostHog
                    </strong>{' '}
                    -- anonymized product analytics
                  </li>
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Sentry
                    </strong>{' '}
                    -- error tracking and performance monitoring
                  </li>
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Resend
                    </strong>{' '}
                    -- transactional email delivery
                  </li>
                </ul>
                <p>
                  We may also disclose information if required by law, legal
                  process, or government request.
                </p>
              </div>
            </div>

            {/* 5. Data Retention */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                5. Data Retention
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <li>
                  Account data is retained for as long as your account is
                  active.
                </li>
                <li>
                  Brand assets (logos, mockups, brand identities) are stored for
                  1 year after account closure, then permanently deleted.
                </li>
                <li>
                  Analytics data is anonymized after 90 days.
                </li>
                <li>
                  Payment records are retained as required by applicable
                  financial regulations.
                </li>
              </ul>
            </div>

            {/* 6. Your Rights */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                6. Your Rights
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>You have the right to:</p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Access
                    </strong>{' '}
                    your personal data and brand assets.
                  </li>
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Correct
                    </strong>{' '}
                    inaccurate information in your account.
                  </li>
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Delete
                    </strong>{' '}
                    your account and associated data.
                  </li>
                  <li>
                    <strong className="text-[var(--bmn-color-text)]">
                      Export
                    </strong>{' '}
                    your brand assets and account data in a portable format.
                  </li>
                </ul>
                <p>
                  To exercise any of these rights, contact us at{' '}
                  <a
                    href="mailto:privacy@brandmenow.com"
                    className="text-[var(--bmn-color-accent)] underline underline-offset-2 hover:text-[var(--bmn-color-accent-hover)]"
                  >
                    privacy@brandmenow.com
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* 7. Cookies */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                7. Cookies
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>
                  We use essential cookies only -- those required for
                  authentication and basic platform functionality. These cannot
                  be disabled.
                </p>
                <p>
                  Analytics are collected via PostHog. You can opt out of
                  analytics tracking at any time from your account settings.
                </p>
                <p>
                  We do not use third-party advertising cookies or tracking
                  pixels.
                </p>
              </div>
            </div>

            {/* 8. Updates */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                8. Changes to This Policy
              </h2>
              <p className="text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                We may update this Privacy Policy from time to time. If we make
                material changes, we will notify you via email or a prominent
                notice within the Service. Your continued use of the Service
                after any changes constitutes acceptance of the updated policy.
              </p>
            </div>

            {/* Contact */}
            <div className="rounded-xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-6">
              <h2
                className="mb-2 text-lg font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                Questions?
              </h2>
              <p className="text-sm text-[var(--bmn-color-text-secondary)]">
                If you have any questions about this Privacy Policy, contact us
                at{' '}
                <a
                  href="mailto:privacy@brandmenow.com"
                  className="text-[var(--bmn-color-accent)] underline underline-offset-2 hover:text-[var(--bmn-color-accent-hover)]"
                >
                  privacy@brandmenow.com
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
