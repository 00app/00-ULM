import type { Metadata } from 'next'
import Link from 'next/link'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import { Footer } from '@/app/components/Footer'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Privacy & Data',
  description:
    'How Zero Zero handles your data: no selling personal information, AI-assisted public research, and your right to request a full wipe.',
  alternates: { canonical: ROUTES.PRIVACY },
}

const PRIVACY_EMAIL = 'privacy@00-00.online'

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-page__inner">
        <ZoneBackToZoneLink className="privacy-page__back" />
        <h2 className="privacy-page__title zz-page-title">Transparency Manifesto</h2>
        <p className="privacy-page__lead">
          Privacy &amp; Data — what we collect, why, and how you stay in control.
        </p>

        <section className="privacy-page__section">
          <h3>Why we ask</h3>
          <p>
            We ask for your postcode, household, and travel habits so savings and carbon figures reflect your
            situation — not a generic UK average. We do not sell your personal data to advertisers or data
            brokers.
          </p>
        </section>

        <section className="privacy-page__section">
          <h3>What we store</h3>
          <p>
            Profile answers, journey responses, and visit breadcrumbs (which cards you opened) live in our
            database so your Zone wall can reload when you return.
          </p>
        </section>

        <section className="privacy-page__section">
          <h3>How we work</h3>
          <p>
            Zero Zero uses AI (Google Gemini) and structured web research (Firecrawl) to analyse public
            tariffs, grants, and guidance — scoped to your postcode and journey category. We do not use your
            chats to train third-party models.
          </p>
        </section>

        <section className="privacy-page__section">
          <h3>Processors</h3>
          <p>
            Hosting and analytics may run on Vercel; database on Neon (EU-friendly regions where configured).
            Each processor is used only to operate the product you asked for.
          </p>
        </section>

        <section className="privacy-page__section">
          <h3>Your rights</h3>
          <p>
            Under UK GDPR you can ask what we hold, correct it, or request deletion. Email us for a full data
            wipe — we will remove your profile, answers, and session rows from active systems.
          </p>
          <p>
            <a href={`mailto:${PRIVACY_EMAIL}`} className="privacy-page__email">
              {PRIVACY_EMAIL}
            </a>
          </p>
        </section>

        <section className="privacy-page__section">
          <h3>Cookies</h3>
          <p>
            We use essential cookies for your session (session, zz_sid) so the app remembers you without
            repeating onboarding.
          </p>
        </section>

        <section className="privacy-page__section">
          <h3>Beta status</h3>
          <p>
            Zero Zero is in beta. Copy and savings figures improve as local research completes; empty
            categories show honest “computing” states rather than invented numbers.
          </p>
          <p>
            <Link href={ROUTES.SETTINGS} className="privacy-page__email">
              Settings
            </Link>{' '}
            lets you review profile data or reset local storage on this device.
          </p>
        </section>
      </div>
      <Footer />
    </main>
  )
}
