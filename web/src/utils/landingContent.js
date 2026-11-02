export const LOGIN_URL = '/login'
export const PARTNER_URL = '/partner'

// Fictional design-preview fixtures, retained from the approved landing HTML.
export const requests = [
  { type: 'O+', units: 2, location: 'Malolos', status: 'Matched' },
  { type: 'A−', units: 1, location: 'Meycauayan', status: 'Donors notified' },
  { type: 'B+', units: 3, location: 'San Jose del Monte', status: 'Fulfilled' },
  { type: 'O−', units: 4, location: 'Bulacan', status: 'Urgent' },
  { type: 'AB+', units: 1, location: 'Marilao', status: 'Matched' },
  { type: 'A+', units: 2, location: 'Hagonoy', status: 'Donors notified' },
]

export const partners = [
  { name: 'Bulacan Medical Center', place: 'Malolos, Bulacan', status: 'Pilot partner', photo: '/care/bulacan-medical-center-official.jpg', photoAlt: 'Bulacan Medical Center building, from the official Provincial Government of Bulacan photo', photoCredit: 'Provincial Government of Bulacan', photoSource: 'https://bulacan.gov.ph/health/bulacan-medical-center/' },
  { name: 'San Jose District Hospital', place: 'San Jose del Monte', status: 'Onboarding', representative: true, photo: '/care/hospital-exterior.jpg', photoAlt: 'Representative hospital building, not San Jose District Hospital', photoCredit: 'Acton Crawford / Unsplash', photoSource: 'https://unsplash.com/photos/8PB_TFEy2XQ' },
  { name: 'Meycauayan City Hospital', place: 'Meycauayan', status: 'Onboarding', representative: true, photo: '/care/hospital-building.jpg', photoAlt: 'Representative hospital building, not Meycauayan City Hospital', photoCredit: 'National Cancer Institute / Unsplash', photoSource: 'https://unsplash.com/photos/1c8sj2IO2I4' },
]

export const perspectives = {
  donors: {
    title: 'Matched by proximity and eligibility.',
    text: 'Donors track health eligibility and donation history. Recipients submit a request and get matched to compatible donors within a 5–25 km radius.',
    checks: ['Eligibility checked before you are alerted', 'Choose a radius from 5 to 25 km', 'In-app and email alerts, one tap to accept', 'A clear history of your confirmed donations'],
  },
  hospitals: {
    title: 'Coordinate every request with confidence.',
    text: 'Manage blood requests, find nearby compatible donors, and keep donation records and inventory together in the hospital dashboard.',
    checks: ['Create standard and emergency blood requests', 'See donor responses and matching status', 'Record screening and confirmed donations', 'View blood inventory and donation history'],
  },
}

export const steps = [
  { title: 'Request submitted', text: 'A hospital or relative posts what is needed: blood type, units, and how urgent it is.', icon: 'request' },
  { title: 'Donors matched', text: 'Dugo+ filters by blood type, eligibility, and radius, then alerts compatible nearby donors.', icon: 'radar' },
  { title: 'Donation confirmed', text: 'Staff confirm your donation, update the stock, and record it in your history.', icon: 'check' },
]

export const values = [
  { title: 'Speed', text: 'Emergency requests reach eligible, nearby donors.', detail: 'Seconds, not days', icon: 'bolt' },
  { title: 'Trust', text: 'Staff-verified requests and screening support accountable matching.', detail: 'Verified every time', icon: 'shield' },
  { title: 'Partnership', text: 'We work directly with hospitals and blood banks on the ground.', detail: 'Built with hospitals', icon: 'heart' },
]

export const faqs = [
  { q: 'Who can donate?', a: 'Eligibility depends on health history and time since your last donation. Dugo+ checks your record before it alerts you, and the blood bank confirms eligibility at the donation itself.' },
  { q: 'How will I be alerted?', a: 'Through in-app notifications and email when a compatible request is near you. You reply to accept, and the hospital sees your answer.' },
  { q: 'Is my personal data safe?', a: 'Contact details stay hidden until you agree to be contacted, and access to your record is logged. The platform is designed around consent-based access and the Data Privacy Act (RA 10173).' },
  { q: 'How can a hospital become a partner?', a: 'Use Become a Partner to open the Dugo+ partnership inquiry form. An inquiry requests follow-up; it does not create a hospital account. Hospital accounts are created by the System Admin.' },
]

export const bloodTypes = ['O−', 'O+', 'A−', 'A+', 'B−', 'B+', 'AB−', 'AB+']
// ABO/Rh red-cell compatibility only. Plasma and platelets follow different rules.
export const redCellRecipients = {
  'O−': ['O−', 'O+', 'A−', 'A+', 'B−', 'B+', 'AB−', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A−': ['A−', 'A+', 'AB−', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B−': ['B−', 'B+', 'AB−', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB−': ['AB−', 'AB+'],
  'AB+': ['AB+'],
}

// Q94-A / Q95-A / Q96-A: all impact, review and hospital content is illustrative.
export const impactMetrics = [
  { value: 1248, label: 'Registered donors', detail: 'A community ready to give', icon: 'heart' },
  { value: 12, label: 'Partner hospitals', detail: 'Care, closer to home', icon: 'hospital' },
  { value: 386, label: 'Requests matched', detail: 'Connections that count', icon: 'connection' },
]

export const reviews = [
  { name: 'Maria D.', initials: 'MD', role: 'Donor', rating: 5, quote: 'Knowing where I can help makes donating feel more personal. The nearby matching view is easy to understand.' },
  { name: 'Paolo R.', initials: 'PR', role: 'Hospital staff', rating: 5, quote: 'Having requests, donor responses, and records in one place makes the next step much clearer.' },
  { name: 'Ana L.', initials: 'AL', role: 'Patient’s family', rating: 4, quote: 'A clear request status would take some of the uncertainty out of looking for a blood donor.' },
  { name: 'Carlo M.', initials: 'CM', role: 'Donor', rating: 5, quote: 'I like being able to see a compatible request nearby and decide when to share my contact details.' },
  { name: 'Bea S.', initials: 'BS', role: 'Hospital staff', rating: 4, quote: 'The screening and donation records feel connected. It is easier to see where a request stands.' },
  { name: 'Jon C.', initials: 'JC', role: 'Donor', rating: 5, quote: 'Seeing my confirmed donation history reminds me of the people each visit can help.' },
]
