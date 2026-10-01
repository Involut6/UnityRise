import { useState } from 'react';
import { ChevronDown, Mail, ShieldCheck } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';

const FAQ: [string, string][] = [
  ['How do I become a verified member?', 'Open Verification, fill in your details, upload your photo, ID, signature and proof of address, then submit. A cooperative administrator reviews it and you are notified of the outcome. Once approved you receive your Membership ID.'],
  ['How do I add money to my savings?', 'Go to Savings and choose Add money. Pick an amount and a payment method (Paystack or Flutterwave). You get a receipt with a reference number. Deposits appear in your balance once the payment provider confirms them.'],
  ['How much can I borrow?', 'Your limit depends on the loan type and your savings balance, for example 2× your savings for a personal loan. The application wizard shows your exact limit before you submit.'],
  ['What is a guarantor?', 'A fellow verified member who agrees to stand behind your loan. You enter their Membership ID, they accept the request in their app, then your loan goes to review.'],
  ['How are loan repayments calculated?', 'Loans use reducing-balance interest with equal monthly instalments. Late instalments attract a one-time penalty of 5% of the instalment. You get reminders 7, 3 and 1 day before each due date.'],
  ['What is the difference between projected and confirmed returns?', 'Projected returns are estimates published with an investment scheme. Confirmed returns are the actual result declared at maturity, which can be higher or lower, and are paid into your savings.'],
  ['How does voting work?', 'Every verified member has one vote per poll or resolution. You can see results after you vote, and a vote cannot be changed once submitted.'],
  ['How is my account protected?', 'Turn on two-factor authentication in Profile & security. We sign you out after 15 minutes of inactivity and record every sign-in so you can spot anything unusual.'],
];
export default function Help() {
  const [open, setOpen] = useState<number | null>(0);
  return <><PageHeader title="Help & support" description="Answers to common questions." />
    <div className="grid max-w-3xl gap-5"><Card padded={false}><ul className="divide-y divide-line">{FAQ.map(([q, a], i) => <li key={q}><h2><button className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left font-semibold" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
      <span className="flex-1">{q}</span><ChevronDown size={18} className={`shrink-0 text-muted transition ${open === i ? 'rotate-180' : ''}`} /></button></h2>{open === i && <p id={`faq-${i}`} className="px-5 pb-4 text-sm text-muted">{a}</p>}</li>)}</ul></Card>
      <Card><CardHeader title="Still need help?" /><div className="flex items-start gap-3 text-sm text-muted"><Mail size={18} className="mt-0.5 shrink-0" /><p>Visit or contact the UnityRise cooperative office. Give them your Membership ID so they can help you faster. Never share your password or authentication codes with anyone, including staff.</p></div>
        <div className="mt-3 flex items-start gap-3 text-sm text-muted"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><p>UnityRise will never ask you for your password or a one-time code.</p></div></Card></div></>;
}
