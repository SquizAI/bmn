import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Brand Me Now terms of service. Read the terms governing your use of our AI-powered brand creation platform.',
  openGraph: {
    title: 'Terms of Service | Brand Me Now',
    description: 'Terms governing your use of Brand Me Now.',
    url: 'https://brandmenow.com/terms',
    images: [{ url: '/og/default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service | Brand Me Now',
    description: 'Terms governing your use of Brand Me Now.',
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="pb-4 pt-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-[var(--bmn-color-text-muted)]">
            Last updated: February 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20 pt-8">
        <div className="mx-auto max-w-[800px] px-4 sm:px-6">
          <div className="space-y-10">
            {/* Intro */}
            <p className="text-[var(--bmn-color-text-secondary)] leading-relaxed">
              These Terms of Service (&quot;Terms&quot;) govern your use of the
              Brand Me Now platform and services operated by Brand Me Now, Inc.
              (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing
              or using our Service, you agree to be bound by these Terms.
            </p>

            {/* 1. Acceptance */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                1. Acceptance of Terms
              </h2>
              <p className="text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                By creating an account or using Brand Me Now, you agree to these
                Terms and our{' '}
                <a
                  href="/privacy"
                  className="text-[var(--bmn-color-accent)] underline underline-offset-2 hover:text-[var(--bmn-color-accent-hover)]"
                >
                  Privacy Policy
                </a>
                . If you do not agree, you may not use the Service. We reserve
                the right to update these Terms at any time. Continued use of
                the Service after changes constitutes acceptance of the revised
                Terms.
              </p>
            </div>

            {/* 2. Service Description */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                2. Service Description
              </h2>
              <p className="text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                Brand Me Now is an AI-powered brand creation platform. We
                provide tools to generate brand identities, logos, product
                mockups, and revenue projections based on your social media
                presence and preferences. The Service is delivered via a
                web-based application and associated APIs.
              </p>
            </div>

            {/* 3. Accounts */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                3. Accounts
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <li>
                  You must be at least 18 years of age to create an account and
                  use the Service.
                </li>
                <li>
                  Each account is for a single individual. Sharing account
                  credentials is prohibited.
                </li>
                <li>
                  You are responsible for maintaining the security of your
                  account and for all activity that occurs under your account.
                </li>
                <li>
                  You must provide accurate, current, and complete information
                  during registration.
                </li>
                <li>
                  Notify us immediately at{' '}
                  <a
                    href="mailto:support@brandmenow.com"
                    className="text-[var(--bmn-color-accent)] underline underline-offset-2 hover:text-[var(--bmn-color-accent-hover)]"
                  >
                    support@brandmenow.com
                  </a>{' '}
                  if you suspect unauthorized access to your account.
                </li>
              </ul>
            </div>

            {/* 4. Intellectual Property */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                4. Intellectual Property
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Your Content:
                  </strong>{' '}
                  You own all brand assets generated for you through the
                  Service, including logos, brand identities, product mockups,
                  and style guides. We grant you a perpetual, worldwide,
                  royalty-free license to use, modify, and distribute these
                  assets for any lawful purpose.
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Aggregate Data:
                  </strong>{' '}
                  We retain the right to use anonymized, aggregate data derived
                  from Service usage to improve our platform and AI models. This
                  data cannot be traced back to individual users.
                </p>
                <p>
                  <strong className="text-[var(--bmn-color-text)]">
                    Our Property:
                  </strong>{' '}
                  The Brand Me Now platform, including its source code,
                  algorithms, AI models, documentation, visual design, and
                  trademarks, is our intellectual property and is protected by
                  applicable laws. Nothing in these Terms grants you rights to
                  our platform beyond the right to use it as a subscriber.
                </p>
              </div>
            </div>

            {/* 5. Subscriptions & Payments */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                5. Subscriptions and Payments
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <li>
                  Paid plans are billed monthly or annually through Stripe.
                  Prices are listed on our{' '}
                  <a
                    href="/pricing"
                    className="text-[var(--bmn-color-accent)] underline underline-offset-2 hover:text-[var(--bmn-color-accent-hover)]"
                  >
                    pricing page
                  </a>
                  .
                </li>
                <li>
                  You may cancel your subscription at any time from your account
                  settings. Cancellations take effect at the end of the current
                  billing cycle.
                </li>
                <li>
                  No refunds are issued for partial months or unused credits.
                </li>
                <li>
                  The free trial does not require a credit card. No charges will
                  occur until you voluntarily upgrade.
                </li>
                <li>
                  We reserve the right to change pricing with 30 days&apos;
                  notice. Existing subscriptions are honored at their current
                  rate until renewal.
                </li>
              </ul>
            </div>

            {/* 6. Acceptable Use */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                6. Acceptable Use
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>You agree not to:</p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    Use the Service to create brands for illegal products or
                    services.
                  </li>
                  <li>
                    Impersonate another person or entity when creating a brand.
                  </li>
                  <li>
                    Reverse engineer, decompile, or disassemble any part of the
                    Service.
                  </li>
                  <li>
                    Use automated tools to access the Service in bulk without an
                    Agency-tier subscription.
                  </li>
                  <li>
                    Interfere with or disrupt the Service or its underlying
                    infrastructure.
                  </li>
                  <li>
                    Resell or redistribute the Service without written
                    authorization.
                  </li>
                  <li>
                    Upload or transmit viruses, malware, or other harmful code.
                  </li>
                </ul>
              </div>
            </div>

            {/* 7. AI-Generated Content */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                7. AI-Generated Content
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>
                  Brand assets generated by our AI are provided &quot;as
                  is.&quot; While we strive for high-quality output, AI
                  generation is inherently probabilistic. We do not guarantee
                  that:
                </p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>Generated brand names are available as trademarks.</li>
                  <li>
                    Generated logos do not resemble existing marks. You are
                    responsible for conducting trademark searches before
                    commercial use.
                  </li>
                  <li>
                    Revenue projections will match actual business performance.
                    Projections are estimates based on industry averages.
                  </li>
                </ul>
                <p>
                  We recommend consulting with a trademark attorney before
                  registering any AI-generated brand name or logo.
                </p>
              </div>
            </div>

            {/* 8. Limitation of Liability */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                8. Limitation of Liability
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, BRAND ME NOW SHALL NOT
                  BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                  CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED
                  TO LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES,
                  ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
                </p>
                <p>
                  Our total aggregate liability for all claims related to the
                  Service shall not exceed the total amount of subscription fees
                  you have paid to us in the twelve (12) months preceding the
                  claim.
                </p>
              </div>
            </div>

            {/* 9. Termination */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                9. Termination
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                <p>
                  We may suspend or terminate your account if you violate these
                  Terms, engage in fraudulent activity, or upon request from law
                  enforcement. We will provide notice where practicable.
                </p>
                <p>
                  You may delete your account at any time from your account
                  settings. Upon deletion, your brand assets will be retained
                  for 1 year per our{' '}
                  <a
                    href="/privacy"
                    className="text-[var(--bmn-color-accent)] underline underline-offset-2 hover:text-[var(--bmn-color-accent-hover)]"
                  >
                    Privacy Policy
                  </a>
                  , after which they will be permanently deleted.
                </p>
              </div>
            </div>

            {/* 10. Governing Law */}
            <div>
              <h2
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                10. Governing Law
              </h2>
              <p className="text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                These Terms are governed by and construed in accordance with the
                laws of the United States. Any disputes arising from these Terms
                or your use of the Service shall be resolved in the state or
                federal courts located within the United States. You agree to
                submit to the personal jurisdiction of such courts.
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
                If you have any questions about these Terms, contact us at{' '}
                <a
                  href="mailto:support@brandmenow.com"
                  className="text-[var(--bmn-color-accent)] underline underline-offset-2 hover:text-[var(--bmn-color-accent-hover)]"
                >
                  support@brandmenow.com
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
