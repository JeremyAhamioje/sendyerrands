import type { Ionicons } from '@expo/vector-icons';

/**
 * Help centre content.
 *
 * Written against what Sendy Errands actually does today, not what it will do. The
 * tracking article says the stepper updates as the order moves and does not
 * mention a live map, because there isn't one — a help centre that describes a
 * feature the app lacks generates the support tickets it exists to prevent.
 *
 * Lives in code rather than the database on purpose: it changes at the speed of
 * the product, ships with the build that changed it, and needs no CMS, no
 * migration and no admin screen to edit. Move it server-side when non-engineers
 * need to edit copy without a release.
 */

export type Article = {
  slug: string;
  q: string;
  a: string[];
};

export type HelpTopic = {
  slug: string;
  title: string;
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
  articles: Article[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: 'orders',
    title: 'Orders & delivery',
    blurb: 'Placing, tracking and changing an order',
    icon: 'cube-outline',
    articles: [
      {
        slug: 'track',
        q: 'How do I track my order?',
        a: [
          'Open the Orders tab and tap the order you want. The tracking screen shows the current stage — waiting for the vendor, being prepared, picked up, on the way, delivered — and updates as your order moves.',
          'Once a rider has your order you will see their name, plate number and rating, with buttons to call them or message them on WhatsApp.',
          'Sendy Errands does not show a rider’s position on a map yet. If you want to know exactly where they are, call them — they are expecting it.',
        ],
      },
      {
        slug: 'change',
        q: 'Can I change my delivery address after ordering?',
        a: [
          'Not from the app. The address is sent to the rider the moment they accept, so changing it in the app would not reach them.',
          'Call your rider directly from the tracking screen if they are already assigned. For anything further than a few streets, contact support — the delivery fee may change.',
        ],
      },
      {
        slug: 'cancel',
        q: 'How do I cancel an order?',
        a: [
          'Open the order from the Orders tab and tap Cancel order. This works until a rider has picked it up.',
          'After pick-up the app will not let you cancel, because the vendor has already been paid and a rider is carrying your goods. Contact support and we will sort it out case by case.',
          'Anything you have already paid goes back to your Sendy Errands Wallet.',
        ],
      },
      {
        slug: 'not-arrived',
        q: 'My order has not arrived',
        a: [
          'Check the tracking screen first — the stage tells you whether the vendor is still preparing it or a rider is on the way.',
          'If a rider is assigned, call them from that screen. Most late deliveries are traffic or a hard-to-find address.',
          'If nobody answers, use Live chat in Support with your order reference and we will find them.',
        ],
      },
    ],
  },
  {
    slug: 'payments',
    title: 'Payments & refunds',
    blurb: 'Wallet, cards and getting money back',
    icon: 'card-outline',
    articles: [
      {
        slug: 'when-charged',
        q: 'When am I charged?',
        a: [
          'For a normal order, when you check out.',
          'For a marketplace request, nothing is charged while vendors are bidding. You are only charged once you pick a winning bid.',
          'For errands, we hold your stated budget up front and reconcile against the receipt afterwards — you get the difference back if the rider spends less.',
        ],
      },
      {
        slug: 'refunds',
        q: 'How do refunds work?',
        a: [
          'Refunds go to your Sendy Errands Wallet immediately, where you can spend them on your next order.',
          'If you would rather have the money back in your bank, contact support. Bank refunds take 3–5 working days because they go back through the card network.',
        ],
      },
      {
        slug: 'wallet',
        q: 'What is the Sendy Errands Wallet?',
        a: [
          'A balance you can hold in the app. Refunds land there instantly, and paying from it is faster than entering a card each time.',
          'You can see every movement in and out under Profile → Sendy Errands Wallet.',
        ],
      },
    ],
  },
  {
    slug: 'marketplace',
    title: 'Marketplace & bidding',
    blurb: 'Posting a request and choosing a vendor',
    icon: 'pricetags-outline',
    articles: [
      {
        slug: 'how-bidding-works',
        q: 'How does bidding work?',
        a: [
          'Post what you need, set a bidding window, and vendors send you a price and an ETA. You pick whichever you prefer — cheapest, fastest or best rated.',
          'Nothing is charged while bidding is open, and you are never obliged to pick a bid.',
          'Once you select a winner we create the order, take payment and assign a rider.',
        ],
      },
      {
        slug: 'no-bids',
        q: 'Nobody bid on my request',
        a: [
          'It happens with unusual items or very short bidding windows. Try posting again with a longer window, or add a photo — vendors bid more readily when they can see exactly what you mean.',
          'A budget helps too. Vendors skip requests where they cannot tell whether the price will be acceptable.',
        ],
      },
      {
        slug: 'photos',
        q: 'Should I add photos to a request?',
        a: [
          'Yes, when the exact item matters. A photo of the part, the model number or the packaging removes most of the back-and-forth and gets you more accurate prices.',
          'You can attach up to three.',
        ],
      },
    ],
  },
  {
    slug: 'riders',
    title: 'Riding with Sendy Errands',
    blurb: 'Signing up, verification and payouts',
    icon: 'bicycle-outline',
    articles: [
      {
        slug: 'sign-up',
        q: 'How do I start riding for Sendy Errands?',
        a: [
          'From Profile, tap Switch to rider app and sign in with the number you want to ride under. You will be asked for your name, what you ride and your plate number.',
          'Rider accounts are separate from customer accounts, so you can keep using the same phone number for both.',
        ],
      },
      {
        slug: 'verification',
        q: 'Why can I not go online yet?',
        a: [
          'You can only go online once your documents are approved. Until then the availability switch stays off and the dashboard shows what is outstanding.',
          'Our team reviews documents during working hours and usually gets through them within a day.',
        ],
      },
      {
        slug: 'payouts',
        q: 'When do I get paid?',
        a: [
          'Earnings appear under the Earnings tab as soon as a delivery is completed.',
          'Payouts go to the bank account on your rider profile. If it needs changing, contact rider support — we cannot change a payout account over chat without verifying it is you.',
        ],
      },
    ],
  },
  {
    slug: 'account',
    title: 'Account & safety',
    blurb: 'Signing in, your data and staying safe',
    icon: 'shield-checkmark-outline',
    articles: [
      {
        slug: 'otp',
        q: 'I am not receiving my code',
        a: [
          'Codes arrive on WhatsApp first and by SMS if that fails. Check the number you entered is the one on your WhatsApp.',
          'Wait for the timer before asking for another — requesting repeatedly locks the number for a few minutes.',
        ],
      },
      {
        slug: 'safety',
        q: 'Is it safe to give my address?',
        a: [
          'Your address is shown only to the rider carrying your order, and only while it is in progress.',
          'Riders are verified with ID and vehicle documents before they can accept anything.',
        ],
      },
      {
        slug: 'delete',
        q: 'How do I delete my account?',
        a: [
          'Contact support and ask. We will confirm it is you, settle any wallet balance, and remove your account.',
          'Orders you have already placed are kept as financial records, but they stop being linked to you.',
        ],
      },
    ],
  },
];

export const topicBySlug = (slug: string) => HELP_TOPICS.find((t) => t.slug === slug);

/** Case-insensitive match across questions, answers and topic titles. */
export function searchHelp(query: string): { topic: HelpTopic; article: Article }[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return HELP_TOPICS.flatMap((topic) =>
    topic.articles
      .filter(
        (article) =>
          article.q.toLowerCase().includes(q) ||
          article.a.some((p) => p.toLowerCase().includes(q)) ||
          topic.title.toLowerCase().includes(q)
      )
      .map((article) => ({ topic, article }))
  );
}
