import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LOGIN_URL, PARTNER_URL, partners, steps, values, faqs, bloodTypes, redCellRecipients, impactMetrics, reviews, perspectives } from '../../utils/landingContent.js'
import DonationMark from '../../components/CareDonationMark.jsx'
import { useLocation, useNavigate } from 'react-router-dom'
import { NewsSection, NewsArticle } from '../../components/CareNews.jsx'
import { photoCredits } from '../../utils/landingNews.js'
import { CountUp, MotionProvider, MotionSection, useMotion, useVisibility } from '../../components/CareMotion.jsx'

function Icon({ name = 'arrow', size = 24, className = '' }) {
  const paths = {
    arrow: <path d="M4 12h15M13 5l7 7-7 7" />,
    chevron: <path d="m7 10 5 5 5-5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <><path d="m7 12 3.5 3.5L18 8" /><circle cx="12" cy="12" r="10" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    radar: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="m12 12 7-7" /></>,
    request: <><rect x="5" y="4" width="14" height="17" rx="3" /><path d="M9 4V2h6v2M8 10h8M8 14h5M8 18h3" /></>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    hospital: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M12 2v6M9 5h6M8 12h2M14 12h2M8 16h2M14 16h2M11 21v-3h2v3" /></>,
    connection: <><circle cx="5" cy="12" r="3" /><circle cx="19" cy="5" r="3" /><circle cx="19" cy="19" r="3" /><path d="m8 11 8-5M8 13l8 5" /></>,
    star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1L12 2Z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>,
    play: <path d="m8 4 12 8-12 8V4Z" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] || paths.arrow}</svg>
}

function Brand() {
  return <a className="brand" href="/#top" aria-label="Dugo+ home"><span className="brand-mark" aria-hidden="true" /><span className="brand-word">dugo<span>+</span></span></a>
}

function Pill({ href, children, outline = false }) {
  return <a className={`pill ${outline ? 'pill-outline' : ''}`} href={href}><span>{children}</span><Icon size={18} /></a>
}

function Header() {
  const [open, setOpen] = useState(false)
  const trigger = useRef(null)
  const links = [['News', '/#news'], ['Our impact', '/#impact'], ['Platform', '/#platform'], ['Partners', '/#partners']]
  useEffect(() => {
    if (!open) return
    const close = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  return <header className="site-header"><div className="header-inner flex items-center justify-between">
    <Brand /><nav className="desktop-nav" aria-label="Main navigation">{links.map(([name, href]) => <a key={name} href={href}>{name}</a>)}<a className="nav-signin" href={LOGIN_URL}>Sign In<span className="tiny-dot" /></a></nav>
    <div className="header-controls"><button className="menu-toggle" ref={trigger} onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-navigation"><Icon name={open ? 'close' : 'menu'} /></button></div>
  </div>{open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{[...links, ['How it works', '/#how-it-works'], ['About', '/#about'], ['Sign In', LOGIN_URL], ['Become a Partner', PARTNER_URL]].map(([name, href]) => <a href={href} key={name} onClick={() => setOpen(false)}>{name}<Icon size={17} /></a>)}</nav>}</header>
}

function Hero() {
  return <MotionSection id="top" className="hero-shell" aria-labelledby="hero-title"><div className="hero">
    <picture className="hero-picture"><img src="/care/hero-donating-blood-pexels.jpg" alt="A donor giving blood, with collection bags beside the donation chair" fetchPriority="high" width="6000" height="4000" /></picture>
    <div className="hero-content page-container"><p className="eyebrow hero-kicker"><span className="tiny-dot" /> A donor-first platform</p><h1 id="hero-title"><span>Blood donor access,</span><span>simplified.</span></h1><p className="hero-description">Dugo+ connects eligible donors, families, and hospitals in real time, so finding the right match takes minutes, not days.</p><div className="hero-actions"><Pill href={LOGIN_URL}>Sign In</Pill><a href="/#impact" className="text-link">Explore Dugo+<Icon size={18} /></a></div><p className="hero-location"><Icon name="pin" size={14} /> Starting in Bulacan, Philippines</p></div>
    <a className="hero-scroll" href="/#impact" aria-label="Explore our impact"><Icon name="chevron" size={20} /></a>
  </div></MotionSection>
}

function Impact() {
  return <MotionSection id="impact" className="impact-section page-container" aria-labelledby="impact-title"><div className="impact-heading"><div><p className="eyebrow">Our community, in numbers</p><h2 id="impact-title">Every connection <em>counts.</em></h2></div><p className="data-label"><span className="tiny-dot" /> Sample data · design preview</p></div><div className="metric-grid grid grid-cols-1 min-[576px]:grid-cols-3">{impactMetrics.map((metric, index) => <article className="metric" key={metric.label}><div className="metric-top"><span>0{index + 1}</span><Icon name={metric.icon} size={24} /></div><strong><CountUp value={metric.value} /></strong><h3>{metric.label}</h3><p>{metric.detail}</p><span className="metric-line" aria-hidden="true"><i data-loop style={{ animationDelay: `${index * .6}s` }} /></span></article>)}</div></MotionSection>
}

function AutoRibbon({ name, children, reverse = false }) {
  const { paused, reduced } = useMotion()
  const { ref: zone, visible } = useVisibility()
  const viewport = useRef(null)
  const track = useRef(null)
  const group = useRef(null)
  const [manual, setManual] = useState(null)
  const activePause = paused || manual !== null || !visible
  useLayoutEffect(() => {
    if (!viewport.current) return
    viewport.current.scrollLeft = manual ?? 0
  }, [manual])
  const move = direction => {
    const period = group.current?.getBoundingClientRect().width || 1
    const card = group.current?.firstElementChild
    const gap = parseFloat(getComputedStyle(group.current).columnGap) || 0
    const step = (card?.getBoundingClientRect().width || 320) + gap
    const transform = getComputedStyle(track.current).transform
    const current = manual ?? (transform === 'none' ? 0 : Math.abs(new DOMMatrixReadOnly(transform).m41))
    setManual((current + direction * step + period) % period)
  }
  return <div onMouseLeave={() => setManual(null)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setManual(null) }} ref={zone} className={`ribbon ${reverse ? 'ribbon-reverse' : ''} ${manual !== null || reduced ? 'ribbon-manual' : ''}`} data-paused={activePause}>
    <div ref={viewport} className="ribbon-viewport" role="region" aria-label={name} tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1) } }}>
      <div className="ribbon-track" ref={track} data-loop><div className="ribbon-group" ref={group}>{children}</div><div className="ribbon-group ribbon-copy" aria-hidden="true" inert>{children}</div></div>
    </div><div className="ribbon-controls page-container"><p>{reduced ? 'Browse with the arrows' : 'Auto-scrolling · hover to pause'}</p><div className="ribbon-buttons"><button onClick={() => move(-1)} aria-label={`Previous ${name}`} className="round-button"><Icon className="rotate-180" size={18} /></button><button onClick={() => move(1)} aria-label={`Next ${name}`} className="round-button"><Icon size={18} /></button></div></div>
  </div>
}

function Stars({ rating }) {
  return <span className="stars" aria-label={`${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(number => <span style={{ '--fill': `${Math.max(0, Math.min(1, rating - number + 1)) * 100}%` }} aria-hidden="true" key={number}>★</span>)}</span>
}

function Reviews() {
  const average = (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
  return <MotionSection className="reviews-section" id="reviews" aria-labelledby="reviews-title"><div className="page-container reviews-heading"><div><p className="eyebrow">Different people. One purpose.</p><h2 id="reviews-title" className="section-title">Care has a way of<br /><em>bringing us together.</em></h2></div><div className="review-summary"><span className="sample-badge">Sample reviews</span><div><strong>{average}<span>/5</span></strong><Stars rating={Number(average)} /></div><p>Illustrative average from {reviews.length} fictional reviews.<br />Not actual user endorsements.</p></div></div><AutoRibbon name="reviews">{reviews.map(review => <article className="review-card" key={review.name}><div className="review-card-top"><Stars rating={review.rating} /><span>{review.rating}.0</span></div><blockquote>“{review.quote}”</blockquote><div className="review-person"><span className="avatar" aria-hidden="true">{review.initials}</span><div><h3>{review.name}</h3><p>{review.role} · fictional reviewer</p></div></div><span className="review-disclosure">Sample review</span></article>)}</AutoRibbon></MotionSection>
}

function MatchingDiagram({ step = 0, feature = false }) {
  return <div className={`matching-diagram ${feature ? 'mini-diagram' : ''}`} data-step={step} aria-hidden="true"><div className="diagram-orbit orbit-one" data-loop /><div className="diagram-orbit orbit-two" data-loop /><div className="diagram-orbit orbit-three" /><svg className="diagram-lines" viewBox="0 0 600 480">{['M105 115 Q280 90 300 240', 'M300 240 Q230 390 100 365', 'M300 240 Q320 90 490 115'].map((path, index) => <g key={path}><path d={path} /><path className={`moving-path ${step === index ? 'is-active' : ''}`} data-loop d={path} /></g>)}</svg><span className="diagram-hub"><span className="brand-mark" /><i className="hub-pulse" data-loop /></span><span className={`diagram-node node-request ${step === 0 ? 'active' : ''}`}><Icon name="request" size={22} /><span>Request</span><small>Blood type + units</small></span><span className={`diagram-node node-donor ${step === 1 ? 'active' : ''}`}><Icon name="heart" size={22} /><span>Nearby donor</span><small>Compatible & ready</small></span><span className={`diagram-node node-hospital ${step === 2 ? 'active' : ''}`}><Icon name="hospital" size={22} /><span>Hospital</span><small>Screen & confirm</small></span><span className="diagram-radius">5–25 km search radius</span><span className="diagram-caption">Illustrative matching process</span><span className="diagram-spark spark-one" data-loop /><span className="diagram-spark spark-two" data-loop /></div>
}

function HowItWorks() {
  const [active, setActive] = useState(0)
  const phaseRefs = useRef([])
  const { reduced } = useMotion()
  const activationLine = () => window.innerHeight * (window.innerWidth < 992 ? .72 : .52)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const phases = phaseRefs.current.filter(Boolean)
      const section = phases[0]?.closest('section')
      if (!section) return
      const line = activationLine()
      const bounds = section.getBoundingClientRect()
      if (bounds.top > line || bounds.bottom < line) return
      let nearest = 0
      let distance = Infinity
      phases.forEach((phase, index) => {
        const rect = phase.getBoundingClientRect()
        const delta = Math.abs(rect.top + rect.height / 2 - line)
        if (delta < distance) { nearest = index; distance = delta }
      })
      setActive(nearest)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame) }
  }, [])
  const choosePhase = index => {
    setActive(index)
    const rect = phaseRefs.current[index]?.getBoundingClientRect()
    if (rect) window.scrollTo({ top: window.scrollY + rect.top + rect.height / 2 - activationLine(), behavior: reduced ? 'instant' : 'smooth' })
  }
  return <MotionSection id="how-it-works" className="journey-section scroll-journey page-container" aria-labelledby="journey-title">
    <div className="journey-heading"><p className="eyebrow">A clear path to giving</p><h2 className="section-title" id="journey-title">From a request.<br /><em>To a donation.</em></h2><p className="section-description">The right people, connected at the right moment.</p><p className="journey-scroll-hint">Scroll to follow the connection <Icon name="chevron" size={16} /></p></div>
    <div className="journey-visual"><MatchingDiagram step={active} /><div className="journey-phase-status"><span>0{active + 1} <i>/ 03</i></span><p>{steps[active].title}</p><div className="journey-phase-dots" aria-hidden="true">{steps.map((step,index) => <span key={step.title} className={index === active ? 'active' : ''} />)}</div></div></div>
    <div className="journey-steps" aria-label="Explore the matching process">{steps.map((step, index) => <button ref={node => { phaseRefs.current[index] = node }} key={step.title} aria-pressed={active === index} aria-current={active === index ? 'step' : undefined} onClick={() => choosePhase(index)} onFocus={() => setActive(index)}><span className="step-number">0{index + 1}</span><span><strong>{step.title}</strong><span className="step-detail">{step.text}</span></span><Icon name="arrow" size={18} /></button>)}</div>
  </MotionSection>
}

function ConnectedByCare() {
  return <MotionSection id="connected-by-care" className="intro page-container text-center" aria-labelledby="intro-title">
    <p className="eyebrow">Connected by care</p>
    <DonationMark />
    <h2 id="intro-title" className="gradient-heading">Purpose-built to match donors to requests with speed, precision, and care.</h2>
    <p className="section-description mx-auto">We believe no request should go unmatched. Dugo+ brings donors, families, and hospital teams together, from the first request to a confirmed donation.</p>
  </MotionSection>
}

function Platform() {
  const [perspective, setPerspective] = useState('donors')
  const content = perspectives[perspective]
  const cards = [
    { image: 'medical-preparation.jpg', title: 'Smart matching', icon: 'radar', text: 'Blood type, eligibility, and a 5–25 km radius bring compatible donors closer to each request.' },
    { image: 'medical-team.jpg', title: 'Hospital coordination', icon: 'request', text: 'Requests, screening, inventory, and donation records support hospital staff in one workspace.' },
    { image: 'medical-consultation.jpg', title: 'Verified & private', icon: 'shield', text: 'Contact details stay hidden until consent is given. Access to donor records is logged.' },
  ]
  return <MotionSection id="platform" className="platform-section outer-panel" aria-labelledby="platform-title">
    <div className="page-container">
      <div className="section-heading-grid">
        <div><p className="eyebrow">Our platform</p><h2 id="platform-title" className="section-title">One connection.<br />A better way to care.</h2></div>
        <p className="section-description">A donor-first platform that connects the right people, at the right time, from request to donation.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 min-[992px]:grid-cols-3 feature-grid">
        {cards.map(card => <article className="feature-card group relative overflow-hidden" key={card.title}>
          <img src={`/care/${card.image}`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <span className="feature-icon"><Icon name={card.icon} size={30} /></span>
          <div className="feature-content"><h3>{card.title}</h3><p>{card.text}</p><a href="/#how-it-works">How it works<Icon size={17} /></a></div>
        </article>)}
      </div>
      <div className="perspective-section grid grid-cols-1 gap-12 min-[992px]:grid-cols-2">
        <div>
          <div className="perspective-controls" aria-label="Platform perspective">
            <button aria-pressed={perspective === 'donors'} onClick={() => setPerspective('donors')}>For donors & recipients</button>
            <button aria-pressed={perspective === 'hospitals'} onClick={() => setPerspective('hospitals')}>For hospitals</button>
          </div>
          <div className="perspective-copy" aria-live="polite" key={perspective}><h3>{content.title}</h3><p>{content.text}</p></div>
        </div>
        <ul className="check-list">{content.checks.map(check => <li key={check}><Icon name="check" size={23} /><span>{check}</span></li>)}</ul>
      </div>
    </div>
  </MotionSection>
}

function Transparency() {
  return <MotionSection id="transparency" className="transparency-section page-container" aria-labelledby="transparency-title"><div className="transparency-copy"><p className="eyebrow">Transparency, at every connection</p><h2 id="transparency-title" className="section-title">Every donation<br /><em>has an address.</em></h2><p className="section-description">Because you deserve to know where your donation is going.</p><p className="transparency-detail">Behind every donation is a place where care happens. A hospital. A community. A connection you can see.</p><a className="text-link" href="/#partners">Meet the hospitals <Icon size={18} /></a></div><div className="address-stage"><div className="address-route" aria-hidden="true"><span>You</span><i /><span><Icon name="hospital" size={18} /> Care</span></div><div className="address-envelope"><div className="address-card-top"><span className="eyebrow">A destination for care</span><Icon name="pin" size={24} /></div><div className="address-scan" aria-hidden="true"><div className="address-print address-blurred"><span>TO / THE HOSPITAL</span><strong>Bulacan Medical Center</strong><p>City of Malolos, Bulacan<br />3000 Philippines</p></div><div className="address-print address-revealed" data-loop><span>TO / THE HOSPITAL</span><strong>Bulacan Medical Center</strong><p>City of Malolos, Bulacan<br />3000 Philippines</p></div><div className="magnifier" data-loop><i /></div></div><p className="sr-only">Illustrative destination: Bulacan Medical Center, City of Malolos, Bulacan 3000 Philippines.</p><div className="address-card-bottom"><span className="tiny-dot" /><span>Illustrative destination · not a live donation record</span></div></div><p className="address-source">Public hospital mailing address · <a href="https://bulacan.gov.ph/health/bulacan-medical-center/" target="_blank" rel="noreferrer">Provincial Government of Bulacan ↗</a></p></div></MotionSection>
}

function Partners() {
  return <MotionSection id="partners" className="partners-section" aria-labelledby="partners-title"><div className="page-container section-heading"><div><p className="eyebrow">Stronger, together</p><h2 id="partners-title" className="section-title">Built with hospitals.<br /><em>For our communities.</em></h2></div><div><p className="section-description">Working with hospitals and blood banks on the ground, growing one connection at a time.</p><Pill href={PARTNER_URL} outline>Become a Partner</Pill></div></div><div className="page-container partner-disclaimer"><span className="sample-badge">Illustrative partners</span><p>Sample names and statuses · not confirmed partnerships</p></div><AutoRibbon name="hospital partners" reverse>{partners.map((partner, index) => <article className={`hospital-card ${partner.photo ? 'has-photo' : ''}`} key={partner.name}>{partner.photo && <div className={`hospital-photo ${partner.representative ? 'representative' : 'official'}`}><img src={partner.photo} alt={partner.photoAlt} loading="lazy" /><a href={partner.photoSource} target="_blank" rel="noreferrer">{partner.representative ? 'Representative photo · ' : ''}{partner.photoCredit} ↗</a></div>}<div className="hospital-card-top"><span>0{index + 1}</span><span className="hospital-symbol" aria-hidden="true"><Icon name="hospital" size={40} /></span><span>{partner.status}</span></div><h3>{partner.name}</h3><p><Icon name="pin" size={14} />{partner.place}</p><span className="hospital-card-note">Illustrative partner</span></article>)}</AutoRibbon></MotionSection>
}

function Compatibility() {
  const [type, setType] = useState('O+')
  const donors = bloodTypes.filter(blood => redCellRecipients[blood].includes(type))
  return <MotionSection id="compatibility" className="compat-section" aria-labelledby="compat-title"><div className="page-container compat-layout"><div className="compat-copy"><p className="eyebrow">A little knowledge. A lasting connection.</p><h2 className="section-title" id="compat-title">Different types.<br /><em>One shared purpose.</em></h2><p className="section-description">Pick a blood type to explore who can give red cells to whom. Plasma and platelets follow different rules.</p><div className="type-selector" aria-label="Select a blood type">{bloodTypes.map(blood => <button key={blood} aria-label={`Select ${blood} blood type`} aria-pressed={blood === type} onClick={() => setType(blood)}>{blood}</button>)}</div><p className="fine-print compat-note">The blood bank confirms eligibility and compatibility.<br /><a href="https://www.redcrossblood.org/donate-blood/blood-types.html" target="_blank" rel="noreferrer">Red-cell compatibility reference ↗</a></p></div><div className="compat-stage" aria-live="polite" aria-atomic="true"><div className="compat-orbit" data-loop aria-hidden="true" /><div className="compat-selected"><strong>{type}</strong><span>Selected blood type</span></div><div className="compat-results" key={type}><div className="compat-result"><h3>Can donate red cells to</h3><div className="blood-chips">{redCellRecipients[type].map(blood => <span key={blood}>{blood}</span>)}</div></div><div className="compat-result"><h3>Can receive red cells from</h3><div className="blood-chips">{donors.map(blood => <span key={blood}>{blood}</span>)}</div></div></div></div></div></MotionSection>
}

function Community() {
  return <MotionSection id="about" className="community-section page-container" aria-labelledby="community-title"><div className="community-map"><img src="/care/source-coverage.svg" alt="Illustrative dotted coverage map of Bulacan" loading="lazy" /><span className="map-pulse pulse-a" data-loop aria-hidden="true" /><span className="map-pulse pulse-b" data-loop aria-hidden="true" /><div className="map-label"><Icon name="pin" size={16} /><span>Bulacan, Philippines<small>Illustrative coverage</small></span></div></div><div className="community-copy"><p className="eyebrow">Rooted in the community</p><h2 id="community-title" className="section-title">Every dot is a donor<br /><em>one alert away.</em></h2><p className="section-description">Starting in Bulacan and growing hospital by hospital. We believe no request should go unmatched.</p><div className="value-rows">{values.map(value => <div key={value.title}><Icon name={value.icon} size={23} /><h3>{value.title}</h3><p>{value.text}</p></div>)}</div></div></MotionSection>
}

function Faqs() {
  const [open, setOpen] = useState(null)
  return <MotionSection id="faq" className="faq-section page-container" aria-labelledby="faq-title"><div><p className="eyebrow">Good to know</p><h2 id="faq-title" className="section-title">A little clarity.<br /><em>A lot of care.</em></h2><p className="section-description">Common questions about giving, matching, and your data.</p><a href="/#contact" className="text-link">Have another question?<Icon size={18} /></a></div><div className="faq-list">{faqs.map((faq, index) => <div key={faq.q} className={`faq-item ${open === index ? 'is-open' : ''}`}><h3><button id={`faq-trigger-${index}`} aria-expanded={open === index} aria-controls={`faq-panel-${index}`} onClick={() => setOpen(open === index ? null : index)}><span>{faq.q}</span><Icon name="plus" size={20} /></button></h3><div id={`faq-panel-${index}`} className="faq-panel" role="region" aria-labelledby={`faq-trigger-${index}`} aria-hidden={open !== index} inert={open !== index}><div><p>{faq.a}</p></div></div></div>)}</div></MotionSection>
}

function Contact() {
  return <MotionSection id="contact" className="contact-section" aria-labelledby="contact-title"><div className="page-container"><div className="contact-copy"><p className="eyebrow">Care starts with a connection</p><h2 id="contact-title">Be part of<br /><em>the next match.</em></h2><p>Working together for the next person who needs a donor.</p><div className="contact-actions"><Pill href={PARTNER_URL}>Become a Partner</Pill><Pill href={LOGIN_URL} outline>Sign In</Pill></div></div><span className="contact-mark" data-loop aria-hidden="true" /><span className="contact-orbit" data-loop aria-hidden="true" /></div></MotionSection>
}

function Footer() {
  return <footer className="site-footer page-container"><div className="footer-grid"><div><Brand /><p className="footer-description">Real-time blood donor matching<br />and emergency request platform.</p><span className="eyebrow footer-platform">A donor-first platform</span></div><div><h2>Explore Dugo+</h2><a href="/#news">The care brief</a><a href="/#impact">Our impact</a><a href="/#reviews">User voices</a><a href="/#how-it-works">How it works</a><a href="/#platform">Platform</a></div><div><h2>Hospital partnerships</h2><a href={PARTNER_URL}>Become a Partner</a><a href={LOGIN_URL}>Sign In</a><p>Starting in Bulacan,<br />Philippines</p></div><div><h2>Made with care</h2><p>Consent-based access</p><p>In-app & email notifications</p><a href="/#faq">Common questions</a></div></div><details className="photo-credits"><summary>Photography credits</summary><p>Representative medical and hospital photography; sources below. News photographs do not depict the reported events or named illustrative partners.</p>{photoCredits.map(photo => <a key={photo.file} href={photo.url} target="_blank" rel="noreferrer">{photo.name} ↗</a>)}<a href="https://bulacan.gov.ph/health/bulacan-medical-center/" target="_blank" rel="noreferrer">Bulacan Medical Center · Provincial Government of Bulacan ↗</a></details><div className="privacy-strip"><Icon name="shield" size={18} /><p>Designed for consent-based, access-controlled handling of health data under RA 10173.</p></div><div className="footer-bottom"><p>© 2026 Dugo+ · UI prototype</p><p>Metrics, reviews and partners are illustrative.</p><a href="/#top">Back to top<Icon className="-rotate-90" size={16} /></a></div></footer>
}

export function LandingBody({ theme }) {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (!location.hash) { window.scrollTo(0, 0); return }
    const frame = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.hash])
  const navigateLocally = event => {
    const link = event.target.closest('a[href]')
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return
    const url = new URL(link.href, window.location.href)
    if (url.origin !== window.location.origin || !/^\/(?:$|login$|register$|partner$|news\/)/.test(url.pathname)) return
    event.preventDefault()
    navigate(url.pathname + url.search + url.hash)
  }
  const match = location.pathname.match(/^\/news\/([^/]+)\/?$/)
  return <MotionProvider theme={theme} onClick={navigateLocally}><a href="#main-content" className="skip-link">Skip to content</a><Header />{match ? <NewsArticle slug={match[1]} /> : <main id="main-content"><Hero /><NewsSection Ribbon={AutoRibbon} /><Impact /><Reviews /><ConnectedByCare /><Platform /><Transparency /><HowItWorks /><Partners /><Compatibility /><Community /><Faqs /><Contact /></main>}<Footer /></MotionProvider>
}
