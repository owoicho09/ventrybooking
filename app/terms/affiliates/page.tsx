import Link from 'next/link';
import { LegalLayout, Section, Sub, P, Ul, Table } from '@/components/legal/LegalDoc';
import { LEGAL_VERSIONS } from '@/lib/legalVersions';

const VERSION      = LEGAL_VERSIONS.affiliatePolicy.version;
const EFFECTIVE    = LEGAL_VERSIONS.affiliatePolicy.effective;
const EMAIL        = 'organizers@ventrybooking.com';
const SUPPORT_EMAIL = 'support@ventrybooking.com';

const toc = [
  { id: 'about',              label: '1. About this policy, and agreeing to it' },
  { id: 'programme',          label: '2. What the programme is' },
  { id: 'eligibility',        label: '3. Who can take part, and what we need from you' },
  { id: 'referral-ids',       label: '4. Referral IDs and how organisers are credited' },
  { id: 'earnings',           label: '5. What you earn' },
  { id: 'qualifying-events',  label: '6. Which events earn commission' },
  { id: 'confirmation',       label: '7. How we confirm an event took place' },
  { id: 'payment',            label: '8. When and how you are paid' },
  { id: 'cancelled-postponed',label: '9. Cancelled, postponed and disputed events' },
  { id: 'self-referral',      label: '10. Self-referral' },
  { id: 'fraud',              label: '11. Fraud and manipulation' },
  { id: 'representation',     label: '12. How you must represent Ventry' },
  { id: 'breach',             label: '13. Breach, suspension and removal' },
  { id: 'duration',           label: '14. Duration of the programme' },
  { id: 'your-information',   label: '15. Your information' },
  { id: 'liability',          label: '16. Our liability to you' },
  { id: 'policy-changes',     label: '17. Changes to this policy' },
  { id: 'governing-law',      label: '18. Governing law and disputes' },
  { id: 'contact',            label: '19. Contact' },
];

export default function AffiliatePolicyPage() {
  return (
    <LegalLayout
      title="Affiliate Programme Policy"
      version={VERSION}
      effective={EFFECTIVE}
      toc={toc}
      intro={
        <>
          This policy is the agreement between you and Ventry if you take part in the Affiliate Programme. Sections 5, 6,
          8, 11 and 12 decide whether and when you get paid. Read them before you refer anyone.
        </>
      }
    >
      <Section id="about" title="1. About this policy">
        <Sub title="1.1 Who we are">
          <P>
            Ventry Solutions (&quot;Ventry&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a business registered in Nigeria under registration
            number BN9586934, with its address in Abuja, Federal Capital Territory. We operate ventrybooking.com.
          </P>
        </Sub>
        <Sub title="1.2 What this policy covers">
          <P>
            This Affiliate Programme Policy (&quot;this Policy&quot;) governs your participation in the Ventry Affiliate
            Programme as a person who refers event organisers to Ventry and earns commission when they sell tickets. Our{' '}
            <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)' }}>Organiser Terms of Use</Link>,{' '}
            <Link href="/terms/buyers" style={{ color: 'var(--color-purple-light)' }}>Buyer Terms of Use</Link> and{' '}
            <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link> also apply to you
            where relevant.
          </P>
        </Sub>
        <Sub title="1.3 You must agree to this policy">
          <P>
            You are asked to confirm that you have read and agreed to this Policy when you create an affiliate account.
            You cannot join the programme without agreeing.
          </P>
        </Sub>
        <Sub title="1.4 Words used in this policy">
          <P>
            &quot;Affiliate&quot;, &quot;you&quot; and &quot;your&quot; mean a person taking part in the programme. &quot;Referred organiser&quot; means an
            organiser credited to you under section 4. &quot;Qualifying event&quot; has the meaning in section 6. &quot;Ticket
            sales&quot; means the total ticket price of paid tickets sold for an event, before fees. &quot;Working day&quot; means
            Monday to Friday, excluding public holidays in Nigeria.
          </P>
        </Sub>
      </Section>

      <Section id="programme" title="2. What the programme is">
        <Sub title="2.1 In summary">
          <P>
            You introduce event organisers to Ventry. When an organiser signs up using your referral ID and runs an
            event that takes place, you earn a share of what Ventry earns on that event.
          </P>
        </Sub>
        <Sub title="2.2 It is a marketing arrangement, nothing more">
          <P>
            Taking part does not make you an employee, agent, partner or representative of Ventry. You have no authority
            to enter into any agreement on Ventry&apos;s behalf, to bind Ventry to anything, to set or vary terms, or to
            make any promise on Ventry&apos;s behalf. You act on your own account and are responsible for your own costs
            and your own tax affairs.
          </P>
        </Sub>
        <Sub title="2.3 The programme is temporary">
          <P>The Affiliate Programme is a marketing initiative and will close. Section 14 explains what happens when it does.</P>
        </Sub>
      </Section>

      <Section id="eligibility" title="3. Who can take part">
        <Sub title="3.1 Eligibility">
          <P>You must be at least 18 years old and resident in Nigeria with a Nigerian bank account.</P>
        </Sub>
        <Sub title="3.2 What we need from you">
          <P>Before we issue you a referral ID, and before we can pay you, you must provide:</P>
          <Ul items={[
            'your full name;',
            'a Nigerian bank account held in that name;',
            'a working email address and phone number.',
          ]} />
          <P>
            We check that the name on the account matches the name you have given. We will not pay commission to an
            account in a different name, and we will not pay commission to a third party on your behalf.
          </P>
        </Sub>
        <Sub title="3.3 We may ask for more">
          <P>
            We keep this light on purpose. Where we are investigating a suspected self-referral, suspected fraud, or a
            pattern of activity that concerns us, we may ask you for further identification and may hold your commission
            until you provide it.
          </P>
        </Sub>
        <Sub title="3.4 Affiliates who are also organisers">
          <P>
            You may hold an organiser account on Ventry and take part in the Affiliate Programme at the same time. You
            may not refer yourself. Section 10 explains what that means.
          </P>
        </Sub>
        <Sub title="3.5 Our discretion">
          <P>We may accept or decline any application to join the programme, and we are not obliged to give reasons.</P>
        </Sub>
      </Section>

      <Section id="referral-ids" title="4. Referral IDs and how organisers are credited to you">
        <Sub title="4.1 Your referral ID">
          <P>Every affiliate is issued a unique referral ID. It is how organisers are credited to you and it is the only record we work from.</P>
        </Sub>
        <Sub title="4.2 How an organiser is credited">
          <P>An organiser is credited to you when they enter your referral ID at sign-up, either by signing up through your referral link or by entering the ID in the referral field during registration.</P>
        </Sub>
        <Sub title="4.3 No referral ID means no referral">
          <P>
            If an organiser signs up without entering a referral ID, they are not credited to anyone. We do not add a
            referral after sign-up, and we do not credit an organiser to you on the basis that you say you introduced
            them. This applies however clear the case appears and however soon afterwards you raise it.
          </P>
          <P>
            We are aware this rule is strict. It exists because the alternative is deciding between competing claims on
            the basis of what people say happened, and we will not do that. Make sure the organiser enters your ID
            before they complete sign-up.
          </P>
        </Sub>
        <Sub title="4.4 One affiliate per organiser">
          <P>An organiser can be credited to one affiliate only. The referral ID entered at sign-up decides it and it does not change afterwards.</P>
        </Sub>
        <Sub title="4.5 No limit on how many you refer">
          <P>There is no cap on the number of organisers you may refer.</P>
        </Sub>
        <Sub title="4.6 Sharing your ID">
          <P>Your referral ID is personal to you. You must not sell it, share it with another affiliate, or allow anyone else to use it.</P>
        </Sub>
      </Section>

      <Section id="earnings" title="5. What you earn">
        <Sub title="5.1 The rate">
          <P>You earn 30% of the platform fee Ventry earns on a qualifying event run by an organiser credited to you.</P>
          <P>Ventry&apos;s platform fee is 3% of ticket sales. Your commission is therefore 0.9% of ticket sales on that event.</P>
        </Sub>
        <Sub title="5.2 Worked example">
          <Table
            head={['Item', 'Amount']}
            rows={[
              ['Ticket sales on the event', '₦1,000,000'],
              ['Ventry platform fee (3%)', '₦30,000'],
              ['Your commission (30% of the platform fee)', '₦9,000'],
              ['Your commission as a share of ticket sales', '0.9%'],
            ]}
          />
        </Sub>
        <Sub title="5.3 What commission is calculated on">
          <P>
            Commission is calculated on ticket sales, meaning the total ticket price of paid tickets sold. It is not
            calculated on the buyer service fee, the payment processing fee, or on any other amount.
          </P>
        </Sub>
        <Sub title="5.4 Only the organiser's first three events">
          <P>
            You earn commission on the first three events run on Ventry by each organiser credited to you. From their
            fourth event onwards you earn nothing on that organiser, however many further events they run.
          </P>
        </Sub>
        <Sub title="5.5 Three events means three events">
          <P>
            The count is by event, not by value. A free event, or an event that sells very little, uses one of the three
            in the same way a large event does. We will not substitute a better event for a smaller one.
          </P>
        </Sub>
        <Sub title="5.6 Free events">
          <P>Ventry charges no platform fee on free events, so there is nothing for you to earn a share of. A free event still uses one of the three.</P>
        </Sub>
        <Sub title="5.7 Cancelled events">
          <P>You earn no commission on an event that is cancelled, whatever the reason and whether or not tickets were sold. A cancelled event does not use one of the three.</P>
        </Sub>
      </Section>

      <Section id="qualifying-events" title="6. Which events earn commission">
        <Sub title="6.1 A qualifying event">
          <P>An event earns you commission only if all of the following are true:</P>
          <Ul items={[
            'the organiser was credited to you under section 4;',
            "it is one of that organiser's first three events on Ventry;",
            'paid tickets were sold for it through Ventry;',
            'the event actually took place, confirmed under section 7;',
            'it is not the subject of an open investigation, and no finding of fraud or serious breach has been made in connection with it;',
            'you are not in breach of this Policy.',
          ]} />
        </Sub>
        <Sub title="6.2 Events that never qualify">
          <P>The following never earn commission:</P>
          <Ul items={[
            'cancelled events;',
            'events that did not take place, whatever the organiser recorded;',
            'events postponed with no valid new date confirmed within 30 days, which are treated as cancellations;',
            'free events, since no platform fee arises;',
            'events where you referred yourself, in breach of section 10;',
            'events where fraud or manipulation of ticket sales has been found.',
          ]} />
        </Sub>
      </Section>

      <Section id="confirmation" title="7. How we confirm an event took place">
        <Sub title="7.1 Why this matters">
          <P>
            Commission is earned on events that happen, not on events that were listed. Ventry settles ticket money to
            organisers before their events, so the date passing is not by itself proof that anything took place.
          </P>
        </Sub>
        <Sub title="7.2 What we look at">
          <P>We confirm that an event took place by reference to:</P>
          <Ul items={[
            'ticket scan and check-in data recorded through Ventry at the event;',
            'whether buyers have complained that the event did not happen or did not happen as advertised;',
            'any other information available to us, including information from the organiser or the venue.',
          ]} />
        </Sub>
        <Sub title="7.3 Where scan data is thin or absent">
          <P>
            Where few or no tickets were scanned, we will look at the event more closely before confirming it. We may
            ask the organiser for evidence and we may delay confirmation while we do. Absence of scan data does not
            automatically mean an event did not happen, but it is the point at which we start asking.
          </P>
        </Sub>
        <Sub title="7.4 Buyer complaints">
          <P>
            Where buyers report that an event did not take place, or that it did not take place as advertised, we will
            investigate before confirming it. Commission is not paid while such an investigation is open.
          </P>
        </Sub>
        <Sub title="7.5 Our determination">
          <P>Whether an event took place is determined by Ventry, acting reasonably, on the information available. Our determination is final for the purposes of this Policy.</P>
        </Sub>
      </Section>

      <Section id="payment" title="8. When and how you are paid">
        <Sub title="8.1 When">
          <P>Commission on a qualifying event is paid within seven working days of Ventry confirming that the event took place under section 7.</P>
        </Sub>
        <Sub title="8.2 Where">
          <P>To your verified settlement account, held in your verified legal name.</P>
        </Sub>
        <Sub title="8.3 No minimum">
          <P>There is no minimum payout threshold. Any amount you have earned is paid.</P>
        </Sub>
        <Sub title="8.4 What you will be able to see">
          <P>
            Your affiliate dashboard shows the organisers credited to you, how many of their three events have been
            used, which events are confirmed, and what has been paid. Where a payment is delayed by an investigation, we
            will tell you that it is held, though we may not be able to tell you why.
          </P>
        </Sub>
        <Sub title="8.5 Tax">
          <P>
            Commission is paid to you as commission. Payments are made subject to any tax or withholding Ventry is
            required by law to deduct. You are responsible for your own tax obligations arising from what you earn,
            including declaring and paying any tax due on it.
          </P>
        </Sub>
        <Sub title="8.6 Refunds and chargebacks after payment">
          <P>
            Where tickets on an event you were paid for are later refunded or charged back, we may recalculate your
            commission on that event and deduct the difference from your next payment, or invoice you for it if no
            further payment is due.
          </P>
        </Sub>
      </Section>

      <Section id="cancelled-postponed" title="9. Cancelled, postponed and disputed events">
        <Sub title="9.1 Cancellation">
          <P>If an event is cancelled you earn nothing on it. This applies whether it is cancelled before or after tickets were sold, and whatever the reason for the cancellation.</P>
          <P>Ventry does not return its platform fee on a cancelled event. That does not create any entitlement for you, because your commission is earned on events that take place and this one did not.</P>
        </Sub>
        <Sub title="9.2 Postponement">
          <P>An event can be postponed once. If it is, commission is not paid at the original date. If the event goes ahead on a valid new date, commission becomes payable when that event is confirmed to have taken place under section 7.</P>
          <P>
            Under the <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)' }}>Organiser Terms of Use</Link> a
            postponement becomes a cancellation where the organiser does not confirm a valid new date within 30 days, or
            needs to move the event a second time. If that happens, nothing is payable to you on that event and it does
            not use one of the organiser&apos;s three.
          </P>
        </Sub>
        <Sub title="9.3 Events under investigation">
          <P>Where Ventry is investigating an event, an organiser or a pattern of transactions, commission on the affected events is held until the investigation concludes. If the investigation finds fraud or serious breach, no commission is payable on those events.</P>
        </Sub>
      </Section>

      <Section id="self-referral" title="10. Self-referral">
        <Sub title="10.1 The rule">
          <P>You may not refer yourself. Commission is for introducing Ventry to someone else.</P>
        </Sub>
        <Sub title="10.2 What counts as referring yourself">
          <P>You have referred yourself if the referred organiser is:</P>
          <Ul items={[
            'you;',
            'an organiser account you control or operate, under any name;',
            'a business, partnership or entity in which you are a director, partner, proprietor or beneficial owner;',
            'a person or entity acting on your instructions or for your benefit in relation to the referral.',
          ]} />
        </Sub>
        <Sub title="10.3 How we assess it">
          <P>
            In deciding whether a referral is a self-referral we may take into account matching or shared identity
            details, settlement account details, contact details, devices, IP addresses, and any other information
            available to us. We will look at substance rather than at the name on the account.
          </P>
        </Sub>
        <Sub title="10.4 Arrangements between affiliates">
          <P>You must not agree with another affiliate to refer each other in order to get around this section. Doing so is treated as self-referral by both of you.</P>
        </Sub>
        <Sub title="10.5 Consequences">
          <P>No commission is payable on a self-referral. Where we find a deliberate self-referral we may also withhold all your unpaid commission and remove you from the programme.</P>
        </Sub>
      </Section>

      <Section id="fraud" title="11. Fraud and manipulation">
        <Sub title="11.1 The rule">
          <P>You must not take part in, assist, encourage or benefit from any attempt to create commission that has not been earned.</P>
        </Sub>
        <Sub title="11.2 Examples">
          <P>This includes:</P>
          <Ul items={[
            'arranging or encouraging the purchase of tickets in order to inflate recorded sales;',
            'working with an organiser to record sales for an event that will not take place;',
            'using stolen, cloned or unauthorised payment instruments, or encouraging their use;',
            'creating accounts, referral IDs or organiser accounts in false names;',
            "any conduct intended to move funds through Ventry rather than to sell tickets to real buyers.",
          ]} />
        </Sub>
        <Sub title="11.3 Consequences">
          <P>
            Where fraud or manipulation is found, no commission is payable to you on any affected event, all your
            unpaid commission is forfeited, you are removed from the programme permanently, and we may recover
            commission already paid, report the matter to law enforcement, and pursue you for any loss we suffer.
          </P>
        </Sub>
      </Section>

      <Section id="representation" title="12. How you must represent Ventry">
        <P>Anything you say to an organiser, Ventry may have to honour. These rules are binding, not guidance.</P>
        <Sub title="12.1 What you must not do">
          <P>You must not:</P>
          <Ul items={[
            'promise ticket sales, sell-outs, or how much an organiser will earn;',
            'offer a discount, a fee reduction, a free event, or any special term. Only Ventry sets terms;',
            'say that a feature exists when it does not;',
            "misstate Ventry's fees, settlement timing, or refund position;",
            'state or imply that Ventry holds buyer money until after an event, that Ventry issues refunds, or that Ventry guarantees any refund. None of these is true;',
            "inflate, round up or guess at Ventry's figures, including how many events we have run;",
            "compare Ventry's fees to another platform's fees;",
            'hold yourself out as an employee, agent or representative of Ventry;',
            "use Ventry's name, logo or branding other than in the materials we give you;",
            "send unsolicited bulk messages, use misleading advertising, or bid on Ventry's name in paid search;",
            'make any statement about Ventry that is untrue or misleading.',
          ]} />
        </Sub>
        <Sub title="12.2 What to do when you do not know">
          <P>
            If you are asked something you cannot answer accurately, say you will find out, and ask us at{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>. An answer given
            properly a day later is worth more than one invented on the spot.
          </P>
        </Sub>
        <Sub title="12.3 Use the current documents">
          <P>
            Quote the current Ventry proposal and policies, not what you remember. Our fees, our settlement timing and
            our refund position are as stated in the current documents, and those documents change from time to time.
            Where what you have said conflicts with the current documents, the documents are correct.
          </P>
        </Sub>
      </Section>

      <Section id="breach" title="13. Breach, suspension and removal">
        <Sub title="13.1 Breach means no commission">
          <P>If you breach this Policy, no commission is payable to you. Depending on what has happened, this may apply to the affected referrals only or to all your unpaid commission, and we decide which.</P>
        </Sub>
        <Sub title="13.2 Serious breach">
          <P>Self-referral, fraud, manipulation of sales, misrepresenting Ventry to an organiser, and offering terms Ventry has not agreed are treated as serious breaches. In these cases all unpaid commission is forfeited and you are removed from the programme.</P>
        </Sub>
        <Sub title="13.3 Suspension">
          <P>We may suspend your referral ID and hold your unpaid commission while we investigate a suspected breach.</P>
        </Sub>
        <Sub title="13.4 Removal">
          <P>We may remove you from the programme where you breach this Policy, where we suspect fraud or unlawful activity, where you fail to provide verification we have requested, or where your conduct presents a risk to Ventry, to organisers or to buyers.</P>
        </Sub>
        <Sub title="13.5 Notice">
          <P>We will notify you by email when we suspend or remove you, and will tell you the reason so far as we are able. We may withhold the reason where telling you would prejudice an investigation or where we are prevented from telling you by law or by a competent authority.</P>
        </Sub>
        <Sub title="13.6 Leaving voluntarily">
          <P>You may leave the programme at any time by telling us. Commission already earned on confirmed events will still be paid, provided you are not in breach of this Policy.</P>
        </Sub>
      </Section>

      <Section id="duration" title="14. Duration of the programme">
        <Sub title="14.1 The programme is temporary">
          <P>The Affiliate Programme is a marketing initiative. Ventry is not taking affiliates on indefinitely and the programme will be withdrawn.</P>
        </Sub>
        <Sub title="14.2 What happens when it closes">
          <P>When the programme closes:</P>
          <Ul items={[
            'no new referral IDs are issued;',
            'no new organisers can be credited to anyone;',
            'organisers already credited to you before closure continue to count, and you continue to earn on their first three events under this Policy;',
            'commission you have already earned is paid as normal.',
          ]} />
        </Sub>
        <Sub title="14.3 Notice of closure">
          <P>We will give affiliates notice by email before the programme closes to new referrals.</P>
        </Sub>
        <Sub title="14.4 Changing the rate">
          <P>We may change the commission rate or the number of qualifying events for future referrals. A change does not affect an organiser already credited to you before the change takes effect.</P>
        </Sub>
      </Section>

      <Section id="your-information" title="15. Your information">
        <Sub title="15.1 Data protection">
          <P>
            We process your personal data in accordance with the Nigeria Data Protection Act 2023 and our{' '}
            <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>.
          </P>
        </Sub>
        <Sub title="15.2 What you can see about your referrals">
          <P>
            Your dashboard shows the organisers credited to you, which of their events have qualified, and what you
            have earned. It does not give you access to an organiser&apos;s personal data, their buyers, their buyers&apos;
            contact details, or their financial information beyond what is needed to show your own commission.
          </P>
        </Sub>
        <Sub title="15.3 Buyer data">
          <P>You have no right to any buyer data through this programme and must not ask an organiser to give you any.</P>
        </Sub>
        <Sub title="15.4 Disclosure to authorities">
          <P>We may disclose information about you and your referrals to law enforcement, regulators, courts and other competent authorities where required by law, on a lawful request or court order, or in connection with suspected fraud or unlawful activity.</P>
        </Sub>
      </Section>

      <Section id="liability" title="16. Our liability to you">
        <Sub title="16.1 No guarantee of earnings">
          <P>Ventry makes no representation about how much you will earn. Your earnings depend on whether the organisers you refer sell tickets and hold their events, and neither is within Ventry&apos;s control or yours.</P>
        </Sub>
        <Sub title="16.2 What we are not liable for">
          <P>We are not liable to you for lost earnings, lost opportunity, or any indirect or consequential loss, including where an organiser you referred cancels an event, leaves the platform, is suspended or removed, or does not sell tickets.</P>
        </Sub>
        <Sub title="16.3 Limit on the amount">
          <P>Where Ventry is liable to you, there is a ceiling on the amount. Our total liability to you in any 12-month period is limited to the total commission paid or payable to you in that period.</P>
          <P>
            What this rules out in practice is a claim for commission you expected but had not yet earned. If an
            organiser you referred runs one event and then leaves the platform, is suspended, or simply never runs
            another, you have earned commission on that one event and nothing more. You cannot claim for the second and
            third events that did not happen. The limit ties what we can be asked to pay to what we actually paid you.
          </P>
        </Sub>
        <Sub title="16.4 What we do not exclude">
          <P>Nothing in this Policy excludes liability that cannot be excluded under Nigerian law, including liability for fraud.</P>
        </Sub>
      </Section>

      <Section id="policy-changes" title="17. Changes to this policy">
        <Sub title="17.1 How changes are made">
          <P>We may change this Policy. The current version is published on ventrybooking.com with its version number and effective date.</P>
        </Sub>
        <Sub title="17.2 You will be emailed">
          <P>We email every affiliate when this Policy changes, and when the Affiliate Field Guide is updated. You do not have to watch the site for changes. Keep your registered email address current, because that is where the notice goes.</P>
        </Sub>
        <Sub title="17.3 Continued participation">
          <P>Continued participation after a change takes effect is acceptance of it. A change does not affect commission you have already earned, or an organiser already credited to you before the change.</P>
        </Sub>
      </Section>

      <Section id="governing-law" title="18. Governing law and disputes">
        <Sub title="18.1 Governing law">
          <P>This Policy is governed by the laws of the Federal Republic of Nigeria.</P>
        </Sub>
        <Sub title="18.2 Raise it with us first">
          <P>
            If you have a dispute about a referral, a payment or a decision under this Policy, raise it with us at{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>. We will look into it
            and respond.
          </P>
        </Sub>
        <Sub title="18.3 Arbitration">
          <P>
            If a dispute is not resolved within 30 days of being raised, it shall be referred to arbitration in Abuja,
            Federal Capital Territory, in accordance with the Arbitration and Mediation Act 2023. The seat is Abuja, the
            language is English, and the arbitrator&apos;s decision is final and binding.
          </P>
        </Sub>
        <Sub title="18.4 Interim relief">
          <P>Nothing in this section prevents either party from applying to a court for urgent interim relief.</P>
        </Sub>
      </Section>

      <Section id="contact" title="19. Contact">
        <Table
          head={['Contact', 'Detail']}
          rows={[
            ['Affiliate & organiser matters', <a key="e" href={`mailto:${EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{EMAIL}</a>],
            ['General support', <a key="s" href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-purple-light)' }}>{SUPPORT_EMAIL}</a>],
            ['Platform', 'www.ventrybooking.com'],
            ['Registered entity', 'Ventry Solutions, RC BN9586934, Abuja, Federal Capital Territory, Nigeria'],
          ]}
        />
      </Section>

      <div
        className="pt-8 border-t flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
      >
        <span>&copy; {new Date().getFullYear()} Ventry. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/terms/organisers" style={{ color: 'var(--color-purple-light)' }}>Organiser Terms</Link>
          <Link href="/privacy" style={{ color: 'var(--color-purple-light)' }}>Privacy Policy</Link>
        </div>
      </div>
    </LegalLayout>
  );
}
