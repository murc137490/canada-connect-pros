/**
 * Platform Terms of Service – summary (for acceptance flow) and full text.
 * Last Updated placeholder: replace with actual date when publishing.
 */

const LAST_UPDATED = "March 2026";
const COMPANY_NAME = "Premiere Services";

/** Terms shown when a client requests a booking (client-only). */
export const TERMS_SUMMARY_BOOKING = `
TERMS APPLICABLE TO BOOKING A SERVICE

Last Updated: ${LAST_UPDATED}

By requesting a booking you agree to the following:

1. PLATFORM ROLE
The Platform operates as a marketplace connecting you with independent service providers. The Platform does not perform services directly and is not responsible for the conduct, quality, or legality of services provided by professionals.

2. PAYMENTS
Payments for services arranged through the platform must be processed through the platform. The platform may collect a service fee or commission.

3. YOUR RESPONSIBILITIES
You must: provide accurate information; maintain a safe environment for the service; communicate honestly about job requirements.

4. SAFETY AND LIABILITY
Service providers are independent contractors. The platform is not liable for property damage, injury, or disputes resulting from services performed by providers.

5. PLATFORM RULES
You may not: arrange off-platform payments with providers introduced through the platform; submit false reviews; engage in harassment or fraudulent activity.

6. ACCEPTANCE
By continuing, you confirm that you have read and accepted these Terms as they apply to your booking.
`.trim();

/** Terms shown when a professional registers (pro-only). */
export const TERMS_SUMMARY_PRO = `
PROFESSIONAL SERVICE PROVIDER – TERMS

Last Updated: ${LAST_UPDATED}

By registering as a professional service provider you agree to the following:

1. INDEPENDENT CONTRACTOR STATUS
You are an independent contractor and not an employee of the Platform.

2. ELIGIBILITY
You must: be legally authorized to perform the services you offer; hold required licenses where applicable; comply with applicable laws.

3. PROFESSIONAL STANDARDS
You must: perform services competently; respect client property; maintain professional conduct.

4. INSURANCE
You are responsible for maintaining appropriate liability insurance where required for your services.

5. PRICING AND PAYOUTS
You set your own pricing. The Platform may charge commissions or service fees. Payments collected through the platform will be distributed according to payout schedules after deducting applicable fees.

6. NON-CIRCUMVENTION
You agree not to: solicit direct payment outside the platform; arrange services off-platform with clients introduced through the platform. Violations may result in termination of your provider account.

7. SAFETY REQUIREMENTS
You must: follow safety standards; disclose risks where relevant; refuse unsafe work conditions.

8. YOUR LIABILITY
You are responsible for: service quality; damages caused during your services; compliance with laws and regulations.

9. ACCEPTANCE
By continuing, you confirm that you have read and accepted these Professional Service Provider Terms.
`.trim();

export const TERMS_FULL_SECTIONS = [
  {
    title: "TERMS OF SERVICE",
    body: `Last updated: ${LAST_UPDATED}\n\nBooking Support\n\nRebooking assistance\nIf an issue occurs, we may help facilitate rebooking with another professional.\n\nResolution support\nWe aim to assist in resolving issues, but services are performed by independent professionals.\n\nReplacement professional\nWhere appropriate, we may help connect you with another provider.`,
  },
  {
    title: "1. INTRODUCTION",
    body: `These Terms of Service (“Terms”) govern the use of the platform operated by ${COMPANY_NAME} (“Platform,” “we,” “us,” or “our”). The Platform connects clients seeking services (“Clients”) with independent professionals (“Service Providers”). By using the Platform, you agree to these Terms.`,
  },
  {
    title: "2. PLATFORM ROLE",
    body: `The Platform acts solely as an intermediary facilitating connections between Clients and Service Providers. The Platform does not perform services, supervise services, or guarantee results. Service Providers are independent contractors and are not employees, agents, or partners of the Platform.`,
  },
  {
    title: "3. NO WARRANTY",
    body: `The Platform makes no warranties or guarantees regarding the quality, safety, legality, suitability, or outcome of services provided by Service Providers. Any verification conducted by the Platform is limited and does not guarantee qualifications, licensing, or background checks.`,
  },
  {
    title: "4. USER ACCOUNTS",
    body: `Users must be at least 18 years old, provide accurate information, and maintain account security. The Platform may suspend or terminate accounts at its sole discretion.`,
  },
  {
    title: "5. USER RESPONSIBILITIES",
    body: `Clients agree to provide accurate service details, ensure safe working conditions, and comply with all applicable laws. Service Providers agree to provide accurate information and perform services lawfully and professionally.`,
  },
  {
    title: "6. REQUESTING QUOTES",
    body: `Users may request quotes without creating an account. Booking or confirming services may require account creation and acceptance of these Terms.`,
  },
  {
    title: "7. BOOKINGS",
    body: `When a booking is confirmed, a separate service agreement is formed directly between the Client and the Service Provider. The Platform facilitates scheduling and payment processing.`,
  },
  {
    title: "8. PAYMENTS",
    body: `Payments may be processed through third-party providers. The Platform may collect payments on behalf of Service Providers, deduct service fees or commissions, and hold funds until services are completed. Service Providers agree not to request or accept off-platform payments for services initiated through the Platform.`,
  },
  {
    title: "9. NON-CIRCUMVENTION",
    body: `Users agree not to bypass the Platform for payments or bookings, or arrange off-platform transactions for services introduced through the Platform. Violations may result in account suspension or termination.`,
  },
  {
    title: "10. CANCELLATION POLICY",
    body: `Cancellations are subject to the terms presented at the time of booking. Late cancellations or missed appointments may result in fees.`,
  },
  {
    title: "11. REFUNDS & DISPUTES",
    body: `Refunds are not guaranteed and are assessed on a case-by-case basis. The Platform may, at its sole discretion, issue full or partial refunds, facilitate rebooking, or deny refund requests. Users agree to attempt to resolve disputes through the Platform before initiating external claims.`,
  },
  {
    title: "12. CHARGEBACKS",
    body: `Users agree not to initiate chargebacks without first attempting resolution through the Platform. Unauthorized chargebacks may result in account suspension or permanent removal.`,
  },
  {
    title: "13. REVIEWS AND RATINGS",
    body: `Clients may submit reviews based on genuine experiences. The Platform may remove reviews that are abusive, fraudulent, misleading, or unrelated.`,
  },
  {
    title: "14. PROPERTY DAMAGE",
    body: `Service Providers are responsible for damages caused during services. Service Providers are encouraged to maintain appropriate liability insurance. The Platform may assist in dispute resolution but is not responsible for damages.`,
  },
  {
    title: "15. PERSONAL INJURY",
    body: `The Platform is not responsible for injuries resulting from services performed by Service Providers. Liability depends on the circumstances and remains between the involved parties.`,
  },
  {
    title: "16. PET SERVICES",
    body: `Clients must disclose relevant information including aggression, medical conditions, and behavioral issues. Service Providers must treat animals humanely and responsibly.`,
  },
  {
    title: "17. COMMUNICATIONS",
    body: `All communications and transactions related to services initiated through the Platform must remain on the Platform.`,
  },
  {
    title: "18. DATA AND PRIVACY",
    body: `By using the Platform, users consent to the collection and use of personal data for service facilitation, communication, and platform improvement. All data is handled in accordance with the Platform’s Privacy Policy.`,
  },
  {
    title: "19. ACCOUNT TERMINATION",
    body: `The Platform may suspend or terminate accounts for fraud, harassment, unsafe behavior, or violation of these Terms.`,
  },
  {
    title: "20. FORCE MAJEURE",
    body: `The Platform is not liable for delays or failures caused by events beyond its control, including but not limited to natural disasters, weather conditions, technical failures, or emergencies.`,
  },
  {
    title: "21. LIMITATION OF LIABILITY",
    body: `To the maximum extent permitted by law, the Platform is not liable for indirect or incidental damages, loss of profits, service provider actions or omissions, or damages arising from service performance.`,
  },
  {
    title: "22. MODIFICATIONS",
    body: `The Platform may update these Terms at any time. Continued use of the Platform constitutes acceptance of the updated Terms.`,
  },
  {
    title: "23. GOVERNING LAW",
    body: `These Terms are governed by the laws of Québec and applicable Canadian law.`,
  },
];

export const TERMS_PROVIDER_AGREEMENT = [
  {
    title: "PROFESSIONAL SERVICE PROVIDER AGREEMENT",
    body: `Service Providers are independent professionals who use the Platform to connect with Clients. This Agreement applies in addition to the Platform Terms of Service.`,
  },
  {
    title: "1. INDEPENDENT CONTRACTOR STATUS",
    body: `Service Providers are independent contractors and not employees of the Platform.`,
  },
  {
    title: "2. ELIGIBILITY",
    body: `Service Providers must be legally authorized to operate, hold required licenses where applicable, and comply with all laws and regulations.`,
  },
  {
    title: "3. PROFESSIONAL STANDARDS",
    body: `Service Providers must perform services competently, act professionally, and respect client property.`,
  },
  {
    title: "4. INSURANCE",
    body: `Service Providers are responsible for maintaining appropriate insurance where required.`,
  },
  {
    title: "5. PRICING",
    body: `Service Providers set their own pricing unless otherwise agreed. The Platform may charge fees or commissions.`,
  },
  {
    title: "6. PAYOUTS",
    body: `Payments collected through the Platform will be distributed according to payout schedules, minus applicable fees.`,
  },
  {
    title: "7. NON-CIRCUMVENTION",
    body: `Service Providers agree not to accept off-platform payments or redirect Platform clients outside the Platform.`,
  },
  {
    title: "8. SAFETY REQUIREMENTS",
    body: `Service Providers must follow safety standards, refuse unsafe work, and disclose risks to clients.`,
  },
  {
    title: "9. PROVIDER LIABILITY",
    body: `Service Providers are solely responsible for service quality, damages caused, and legal compliance.`,
  },
  {
    title: "10. PLATFORM RIGHTS",
    body: `The Platform reserves the right to remove listings, suspend accounts, or modify the visibility of profiles.`,
  },
  {
    title: "GOVERNING LAW",
    body: `This Professional Service Provider Agreement is governed by the laws of Québec and applicable Canadian law.`,
  },
];

export { LAST_UPDATED, COMPANY_NAME };
