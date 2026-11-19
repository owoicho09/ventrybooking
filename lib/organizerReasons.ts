// Copy for the /organizers landing page. Word-for-word from the signed-off
// design (ventry-organizers-page-prompt.md): don't edit without the client.

export interface Reason { n: string; bold: string; rest?: string }
export interface ReasonGroup { label: string; items: Reason[] }
export interface TopReason { n: string; title: string; body: string }
export interface StepItem { n: number; title: string; body: string }

export const TOP_SIX: TopReason[] = [
  { n: '01', title: 'Paid the next working day', body: 'Sell on Monday, get paid on Tuesday. 97% of every ticket is yours.' },
  { n: '02', title: '3% fee, not 5%', body: 'Free to list. You only pay when a ticket sells, so you keep 2% more.' },
  { n: '03', title: 'Buyers trust you', body: 'Every organizer is ID-verified, and the Verified badge shows your venue is confirmed.' },
  { n: '04', title: 'A door that can’t be faked', body: 'Each QR ticket scans once. Your team checks guests in on their own phones.' },
  { n: '05', title: 'Your page, your brand', body: 'Your banner, your colours and your own link: ventrybooking.com/your-event.' },
  { n: '06', title: 'An audience that grows', body: 'Notify Me, ratings and your Audience carry into your next event.' },
];

export const REASON_GROUPS: ReasonGroup[] = [
  {
    label: 'Get paid',
    items: [
      { n: '01', bold: 'Paid the next working day', rest: ', at 97%' },
      { n: '02', bold: 'Free to list', rest: ': no setup fee or subscription' },
      { n: '03', bold: '3% fee, not 5%', rest: ': you keep 2% more' },
      { n: '04', bold: 'Honest checkout', rest: ': every fee shown upfront' },
      { n: '05', bold: 'Guest checkout', rest: ', no account needed to buy' },
      { n: '06', bold: 'Sponsor link', rest: ': partners watch your sales live' },
    ],
  },
  {
    label: 'Trust',
    items: [
      { n: '07', bold: 'ID-verified organizers' },
      { n: '08', bold: 'Verified Event badge', rest: ' backed by venue proof' },
      { n: '09', bold: 'Real support', rest: ': help bot plus the Ventry team' },
    ],
  },
  {
    label: 'At the door',
    items: [
      { n: '10', bold: 'QR check-in', rest: ' on any phone' },
      { n: '11', bold: 'In-app scanner', rest: ', no extra app' },
      { n: '12', bold: 'Named staff IDs', rest: ' for every scan' },
      { n: '13', bold: 'Each QR scans once', rest: ', so copies don’t get in' },
    ],
  },
  {
    label: 'Your brand',
    items: [
      { n: '14', bold: 'Branded event page', rest: ': your banner, colours and logo' },
      { n: '15', bold: 'Your own link', rest: ': ventrybooking.com/your-event' },
      { n: '16', bold: 'Organizer page', rest: ' with your past events and photos' },
      { n: '17', bold: 'Share previews', rest: ' that show your flyer' },
      { n: '18', bold: 'Confirmation emails', rest: ' in your event’s name' },
    ],
  },
  {
    label: 'Selling',
    items: [
      { n: '19', bold: 'Ticket tiers and tables', rest: ', each with its own capacity' },
      { n: '20', bold: 'Sold-out tiers', rest: ' close automatically' },
      { n: '21', bold: 'Lineup', rest: ': Headliner, Guest Artist, Special and Surprise Guest' },
      { n: '22', bold: 'Scheduled go-live', rest: ' at the time you pick' },
      { n: '23', bold: 'Address reveals', rest: ' for secret locations' },
      { n: '24', bold: 'Free ₦0 events', rest: ' with no platform fee' },
      { n: '25', bold: 'Access codes', rest: ' for VIP and early-bird tiers' },
      { n: '26', bold: 'Tiers locked to an email domain', rest: ', e.g. students only' },
      { n: '27', bold: 'Online events', rest: ' via Zoom, Meet or Teams' },
      { n: '28', bold: 'Promoter tracking links' },
      { n: '29', bold: 'QR codes', rest: ' for your flyers' },
    ],
  },
  {
    label: 'Your crowd',
    items: [
      { n: '30', bold: 'Your Audience', rest: ': email past buyers for free' },
      { n: '31', bold: 'Notify Me', rest: ' followers on your page' },
      { n: '32', bold: 'Email reminders', rest: ' before the event' },
      { n: '33', bold: 'Ratings', rest: ' after every event' },
      { n: '34', bold: 'Live dashboard', rest: ' and attendee list' },
      { n: '35', bold: 'Daily sales email' },
      { n: '36', bold: 'Ticket retrieval', rest: ' for buyers' },
    ],
  },
];

export const STEPS: StepItem[] = [
  { n: 1, title: 'Create your account', body: 'Your legal name, the name buyers see, your email and phone.' },
  { n: 2, title: 'Verify your ID', body: 'NIN for individuals, CAC for businesses, before your event goes live.' },
  { n: 3, title: 'List and sell', body: 'Set your tiers, add your flyer and share your link.' },
];

export const ORGANIZER_SIGNUP_HREF = '/organizer/register';
export const ORGANIZER_CONTACT_EMAIL = 'organizers@ventrybooking.com';
