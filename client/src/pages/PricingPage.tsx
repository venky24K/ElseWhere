import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  HelpCircle,
} from 'lucide-react';

export function PricingPage() {
  const [annualBilling, setAnnualBilling] = useState(true);

  const plans = [
    {
      name: 'Free (Hobbyist)',
      tagline: 'Ideal for individual students, self-hosters, and personal paper writing.',
      price: '$0',
      period: 'forever',
      highlighted: false,
      badge: 'Free Forever',
      ctaText: 'Start Free in Studio',
      ctaLink: '/project/default',
      features: [
        'Unlimited local compilation on your machine',
        'All starter templates included (IEEE, Nature, Thesis)',
        'Full offline Virtual File System support',
        'Bi-directional SyncTeX navigation',
        'Bring Your Own API Key (BYOK) for Groq & Gemini',
        '250M+ OpenAlex & arXiv literature search',
      ],
      notIncluded: [
        'Included managed AI token credits',
        'Continuous Cloud DB Auto-Save across devices',
        'Priority cloud compiler sandbox queue',
        'Multi-user team workspaces & live co-authoring',
      ],
    },
    {
      name: 'Pro Researcher',
      tagline: 'For publishing scholars, professors, and authors needing managed AI and cloud sync.',
      price: annualBilling ? '$12' : '$15',
      period: 'per month',
      highlighted: true,
      badge: 'Most Popular',
      ctaText: 'Upgrade to Pro',
      ctaLink: '/project/default',
      features: [
        'Everything in Free tier, plus:',
        '✨ Included Managed AI Key (5M tokens/mo Groq & Gemini — zero setup required)',
        'Continuous Cloud Database Sync & Auto-Save across all devices',
        'Priority Cloud Sandboxed Compilation Queue when off host machine',
        'Full AI Error Doctor self-repair & literature review synthesizer',
        '1-Click "Import from Overleaf" with automated directory parsing',
        'High-resolution 600 DPI PDF and standalone TikZ vector export',
      ],
      notIncluded: [
        'Multi-user team workspaces & live co-authoring',
        'Institutional Single Sign-On (SAML / ORCID)',
      ],
    },
    {
      name: 'Lab & Team',
      tagline: 'For university research groups, AI labs, and collaborative co-authoring teams.',
      price: annualBilling ? '$24' : '$30',
      period: 'per user / month',
      highlighted: false,
      badge: 'Lab Teams',
      ctaText: 'Start Lab Trial',
      ctaLink: '/project/default',
      features: [
        'Everything in Pro tier, plus:',
        'Pooled Organization AI token allowances with centralized billing',
        'Multiplayer CRDT real-time co-authoring with colored live cursors',
        'Shared Lab LaTeX template and macro repository',
        'Shared group bibliography (.bib) and figure asset libraries',
        'Granular RBAC: Owner, Maintainer, Co-Author, Reviewer, Viewer',
        'Track Changes mode with author accept/reject diff controls',
      ],
      notIncluded: [
        'Custom on-premise Kubernetes cluster deployment',
      ],
    },
    {
      name: 'Institutional',
      tagline: 'For university departments, research institutes, and enterprise organizations.',
      price: 'Custom',
      period: 'annual contract',
      highlighted: false,
      badge: 'Enterprise',
      ctaText: 'Contact Academic Sales',
      ctaLink: 'mailto:sales@elsewhere.latex',
      features: [
        'Everything in Lab & Team tier, plus:',
        'On-premise Docker / Kubernetes cluster deployment',
        'Institutional Single Sign-On (SAML, Shibboleth, EduGAIN, ORCID)',
        '100% Data Sovereignty: dedicated private host compiler nodes',
        'Custom SLA, priority engineering onboarding, and training sessions',
        'Unlimited pooled AI token tiers & compliance auditing',
      ],
      notIncluded: [],
    },
  ];

  const faqs = [
    {
      q: 'How does the included Managed AI Key work in Pro?',
      a: 'With Pro, you don’t need to register personal developer accounts on Groq or Google Cloud. ElseWhere provides high-speed, pre-configured LPU and Gemini 3.8 Flash access directly out of the box with an allowance of 5,000,000 tokens every month.',
    },
    {
      q: 'Can I use ElseWhere 100% free with my own API keys?',
      a: 'Yes! The Free tier includes full Bring-Your-Own-Key (BYOK) functionality. You can input your personal Groq or Google Gemini API keys in the AI settings modal with zero markup and unlimited local compilation.',
    },
    {
      q: 'Does compilation work offline?',
      a: 'Absolutely. Because ElseWhere is built local-first, the editor uses your host system’s native Tectonic, MiKTeX, or TeX Live installation. You can write, compile, and debug papers on flights or trains without any internet connection.',
    },
    {
      q: 'Do you offer academic or student discounts?',
      a: 'Yes, verified university students and academic lab researchers with a valid .edu or university institutional email address receive an automatic 40% discount on all Pro plans.',
    },
  ];

  return (
    <div className="flex flex-col w-full py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-wider text-brand px-3 py-1 rounded-full bg-brand/10 border border-brand/20">
          Transparent Academic Pricing
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-text-primary tracking-tight">
          Write Freely. Scale With Managed AI.
        </h1>
        <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
          Local compilation is always free. Upgrade when you want bundled AI intelligence, continuous cloud backup, and team collaboration.
        </p>

        {/* Annual / Monthly Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3 text-xs font-medium">
          <span className={!annualBilling ? 'text-text-primary font-bold' : 'text-text-muted'}>
            Monthly Billing
          </span>
          <button
            type="button"
            onClick={() => setAnnualBilling(!annualBilling)}
            className="w-12 h-6 rounded-full bg-brand/20 p-0.5 transition-colors cursor-pointer relative"
            aria-label="Toggle annual billing"
          >
            <div
              className={`w-5 h-5 rounded-full bg-brand transition-transform ${
                annualBilling ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={annualBilling ? 'text-text-primary font-bold flex items-center gap-1.5' : 'text-text-muted'}>
            Annual Billing
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Save 20%
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-6 flex flex-col justify-between transition-all ${
              plan.highlighted
                ? 'border-2 border-brand bg-sidebar shadow-xl relative'
                : 'border border-border-subtle bg-sidebar hover:border-border-light hover:shadow-md'
            }`}
          >
            <div>
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  {plan.badge}
                </div>
              )}

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  {plan.name}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-text-primary">{plan.price}</span>
                  <span className="text-xs text-text-muted">/{plan.period}</span>
                </div>
                <p className="text-xs text-text-secondary leading-normal min-h-[40px]">
                  {plan.tagline}
                </p>
              </div>

              {/* Feature Checklist */}
              <div className="pt-6 border-t border-border-subtle space-y-2.5 text-xs text-text-primary">
                {plan.features.map((feat) => (
                  <div key={feat} className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span className={feat.startsWith('✨') ? 'font-semibold text-brand' : ''}>
                      {feat}
                    </span>
                  </div>
                ))}
                {plan.notIncluded.map((feat) => (
                  <div key={feat} className="flex items-start gap-2 text-text-muted opacity-60">
                    <span className="text-xs shrink-0">✕</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-border-subtle mt-6">
              <Link
                to={plan.ctaLink}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-center transition-all inline-block no-underline ${
                  plan.highlighted
                    ? 'bg-brand hover:bg-brand-hover text-white shadow-md shadow-brand/20'
                    : 'bg-card border border-border-light hover:bg-card-hover text-text-primary'
                }`}
              >
                {plan.ctaText}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto space-y-6 pt-8">
        <div className="text-center space-y-1">
          <h3 className="text-2xl font-bold text-text-primary tracking-tight">Frequently Asked Questions</h3>
          <p className="text-xs text-text-secondary">Everything you need to know about our billing and features.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="p-5 rounded-xl border border-border-subtle bg-sidebar space-y-1.5">
              <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <HelpCircle size={15} className="text-brand shrink-0" />
                {faq.q}
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed pl-6">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
