import { BudgetTier, CityTier, EventIdeas, EventType } from './types';

export interface TemplatePercentage {
  category: string;
  pct: number;
  defaultLeadDays: number;
  defaultDurationDays: number;
  dependsOnCategories: string[];
  defaultTaskTitle: string;
  defaultOwner: string;
}

// Appendix A: Exact Budget Templates & Lead Times
export const EVENT_TEMPLATES: Record<EventType, TemplatePercentage[]> = {
  wedding: [
    {
      category: 'Catering',
      pct: 30,
      defaultLeadDays: 150,
      defaultDurationDays: 14,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Finalize halwai & multi-function catering menu with tasting',
      defaultOwner: 'Riya',
    },
    {
      category: 'Venue',
      pct: 18,
      defaultLeadDays: 180,
      defaultDurationDays: 10,
      dependsOnCategories: [],
      defaultTaskTitle: 'Lock heritage venue contract, lawn capacity & rain backup',
      defaultOwner: 'Riya',
    },
    {
      category: 'Decor and florals',
      pct: 10,
      defaultLeadDays: 90,
      defaultDurationDays: 12,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Approve mandap, sangeet stage & floral design production sheet',
      defaultOwner: 'Aarav',
    },
    {
      category: 'Attire and jewellery',
      pct: 10,
      defaultLeadDays: 90,
      defaultDurationDays: 21,
      dependsOnCategories: [],
      defaultTaskTitle: 'Complete bridal/groom fittings & jewellery vault scheduling',
      defaultOwner: 'Kavita',
    },
    {
      category: 'Photo and video',
      pct: 8,
      defaultLeadDays: 150,
      defaultDurationDays: 7,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Book candid photo + cinema crew & share shot list',
      defaultOwner: 'Aarav',
    },
    {
      category: 'Entertainment and music',
      pct: 5,
      defaultLeadDays: 60,
      defaultDurationDays: 7,
      dependsOnCategories: ['Decor and florals'],
      defaultTaskTitle: 'Confirm DJ, dhol players, sound rider & PPL license',
      defaultOwner: 'Rohan',
    },
    {
      category: 'Accommodation and travel',
      pct: 5,
      defaultLeadDays: 60,
      defaultDurationDays: 10,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Block guest hotel room inventory & station pickup shuttles',
      defaultOwner: 'Vikram',
    },
    {
      category: 'Rituals and logistics',
      pct: 4,
      defaultLeadDays: 45,
      defaultDurationDays: 5,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Brief Pandit ji, compile puja samagri & baraat route timings',
      defaultOwner: 'Kavita',
    },
    {
      category: 'Invitations and gifts',
      pct: 3,
      defaultLeadDays: 60,
      defaultDurationDays: 10,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Dispatch digital save-the-dates, print cards & mithai favors',
      defaultOwner: 'Riya',
    },
    {
      category: 'Makeup and mehendi',
      pct: 2,
      defaultLeadDays: 60,
      defaultDurationDays: 5,
      dependsOnCategories: ['Attire and jewellery'],
      defaultTaskTitle: 'Book bridal MUA trial & mehendi artist team for guests',
      defaultOwner: 'Riya',
    },
    {
      category: 'Contingency',
      pct: 5,
      defaultLeadDays: 14,
      defaultDurationDays: 3,
      dependsOnCategories: ['Catering', 'Decor and florals'],
      defaultTaskTitle: 'Reconcile final vendor balances & emergency cash float',
      defaultOwner: 'Riya',
    },
  ],
  birthday: [
    {
      category: 'Catering',
      pct: 35,
      defaultLeadDays: 21,
      defaultDurationDays: 4,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Lock kids + adults snack & buffet menu (nut-free labels)',
      defaultOwner: 'Arjun',
    },
    {
      category: 'Venue',
      pct: 20,
      defaultLeadDays: 30,
      defaultDurationDays: 4,
      dependsOnCategories: [],
      defaultTaskTitle: 'Reserve clubhouse / cafe party hall & confirm seating capacity',
      defaultOwner: 'Arjun',
    },
    {
      category: 'Decor',
      pct: 12,
      defaultLeadDays: 14,
      defaultDurationDays: 3,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Confirm theme backdrop, welcome board & eco balloon arch',
      defaultOwner: 'Neha',
    },
    {
      category: 'Entertainment and games',
      pct: 12,
      defaultLeadDays: 21,
      defaultDurationDays: 3,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Book game host, science/magic activity station & prizes',
      defaultOwner: 'Arjun',
    },
    {
      category: 'Cake',
      pct: 6,
      defaultLeadDays: 7,
      defaultDurationDays: 2,
      dependsOnCategories: ['Decor'],
      defaultTaskTitle: 'Order custom theme fondant/cream cake & delivery slot',
      defaultOwner: 'Neha',
    },
    {
      category: 'Return gifts',
      pct: 5,
      defaultLeadDays: 14,
      defaultDurationDays: 4,
      dependsOnCategories: ['Invitations'],
      defaultTaskTitle: 'Assemble age-appropriate STEM/craft return gift hampers',
      defaultOwner: 'Neha',
    },
    {
      category: 'Photography',
      pct: 3,
      defaultLeadDays: 14,
      defaultDurationDays: 2,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Book 3-hour event candid photographer',
      defaultOwner: 'Arjun',
    },
    {
      category: 'Invitations',
      pct: 2,
      defaultLeadDays: 14,
      defaultDurationDays: 2,
      dependsOnCategories: ['Venue'],
      defaultTaskTitle: 'Send WhatsApp invite card & collect parent RSVP headcount',
      defaultOwner: 'Arjun',
    },
    {
      category: 'Contingency',
      pct: 5,
      defaultLeadDays: 3,
      defaultDurationDays: 1,
      dependsOnCategories: ['Catering', 'Cake'],
      defaultTaskTitle: 'Final day-of checklist, extra plates & emergency buffer',
      defaultOwner: 'Arjun',
    },
  ],
  community: [
    {
      category: 'Venue, permits, infrastructure',
      pct: 25,
      defaultLeadDays: 60,
      defaultDurationDays: 14,
      dependsOnCategories: [],
      defaultTaskTitle: 'Secure ground booking, municipal/police NOC & sound permit',
      defaultOwner: 'Meena',
    },
    {
      category: 'Food and beverage',
      pct: 20,
      defaultLeadDays: 30,
      defaultDurationDays: 7,
      dependsOnCategories: ['Venue, permits, infrastructure'],
      defaultTaskTitle: 'Onboard regional food stall vendors, FSSAI check & drinking water',
      defaultOwner: 'Suresh',
    },
    {
      category: 'Stalls and decor',
      pct: 15,
      defaultLeadDays: 30,
      defaultDurationDays: 7,
      dependsOnCategories: ['Venue, permits, infrastructure'],
      defaultTaskTitle: 'Finalize octonorm stall layout, festive lighting & electrical load',
      defaultOwner: 'Rajesh',
    },
    {
      category: 'Entertainment',
      pct: 12,
      defaultLeadDays: 30,
      defaultDurationDays: 5,
      dependsOnCategories: ['Stalls and decor'],
      defaultTaskTitle: 'Schedule cultural troupe, RWA talent showcase & PA system',
      defaultOwner: 'Anita',
    },
    {
      category: 'Safety, medical, insurance',
      pct: 8,
      defaultLeadDays: 21,
      defaultDurationDays: 5,
      dependsOnCategories: ['Venue, permits, infrastructure'],
      defaultTaskTitle: 'Deploy fire extinguishers, first-aid booth, ambulance & crowd gates',
      defaultOwner: 'Col. Verma',
    },
    {
      category: 'Marketing',
      pct: 5,
      defaultLeadDays: 21,
      defaultDurationDays: 5,
      dependsOnCategories: ['Venue, permits, infrastructure'],
      defaultTaskTitle: 'Circulate sponsor banners, RWA notices & digital posters',
      defaultOwner: 'Anita',
    },
    {
      category: 'Volunteer needs',
      pct: 5,
      defaultLeadDays: 30,
      defaultDurationDays: 6,
      dependsOnCategories: ['Safety, medical, insurance'],
      defaultTaskTitle: 'Publish 2-shift volunteer roster, ID badges & hydration desk',
      defaultOwner: 'Meena',
    },
    {
      category: 'Waste and cleanup',
      pct: 3,
      defaultLeadDays: 14,
      defaultDurationDays: 3,
      dependsOnCategories: ['Food and beverage'],
      defaultTaskTitle: 'Arrange twin-bin segregation stations & post-mela sweep crew',
      defaultOwner: 'Suresh',
    },
    {
      category: 'Contingency',
      pct: 7,
      defaultLeadDays: 7,
      defaultDurationDays: 2,
      dependsOnCategories: ['Safety, medical, insurance', 'Volunteer needs'],
      defaultTaskTitle: 'Final safety walkthrough & RWA treasury contingency sign-off',
      defaultOwner: 'Meena',
    },
  ],
};

// City Tier Classification (1 = Metro, 2 = Tier-2 Heritage/Growth, 3 = Regional)
export function inferCityTier(city: string): CityTier {
  const c = city.trim().toLowerCase();
  const tier1 = ['mumbai', 'delhi', 'new delhi', 'bengaluru', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'gurugram', 'noida'];
  const tier2 = ['jaipur', 'udaipur', 'ahmedabad', 'chandigarh', 'lucknow', 'indore', 'kochi', 'goa', 'surat', 'bhopal', 'coimbatore', 'nagpur', 'mysuru', 'vadodara', 'dehradun'];
  if (tier1.some((t) => c.includes(t))) return 1;
  if (tier2.some((t) => c.includes(t))) return 2;
  return 3;
}

// Estimated per-guest healthy bands in INR (labeled as editable assumptions per Appendix A)
export const ESTIMATED_PER_GUEST_BANDS: Record<
  EventType,
  Record<BudgetTier, { min: number; target: number; max: number }>
> = {
  wedding: {
    lean: { min: 2500, target: 4000, max: 6000 },
    standard: { min: 4500, target: 6000, max: 10000 },
    premium: { min: 9000, target: 15000, max: 30000 },
  },
  birthday: {
    lean: { min: 600, target: 900, max: 1400 },
    standard: { min: 1000, target: 1500, max: 2500 },
    premium: { min: 2200, target: 3500, max: 6000 },
  },
  community: {
    lean: { min: 250, target: 450, max: 800 },
    standard: { min: 450, target: 750, max: 1500 },
    premium: { min: 1200, target: 2000, max: 4000 },
  },
};

export interface RagTemplateDoc {
  id: string;
  event_type: EventType;
  region: string;
  kind: 'rituals' | 'permits' | 'safety' | 'menu' | 'activities' | 'run_of_show' | 'decor';
  title: string;
  body: string;
  source: string;
}

// Curated RAG Documents with Citation IDs (Appendix A)
export const RAG_TEMPLATES: RagTemplateDoc[] = [
  {
    id: 'TPL-WED-01',
    event_type: 'wedding',
    region: 'North & West India (Jaipur / Delhi)',
    kind: 'rituals',
    title: 'Multi-Function Wedding Sequence & Lead Times',
    body: 'Standard 2-day sequence: Day 1 Noon Mehendi & Folk Welcome (4 hrs), Day 1 Evening Sangeet & Ring Ceremony (sound cut-off 10:00 PM outdoors per noise rules). Day 2 Morning Haldi, Afternoon Baraat assembly, Dusk Pheras & Reception dinner.',
    source: 'Aayojan Curated Wedding Operations Guide v1.2',
  },
  {
    id: 'TPL-WED-02',
    event_type: 'wedding',
    region: 'Rajasthan / Jaipur',
    kind: 'menu',
    title: 'Rajasthani + North Indian Wedding Feast Architecture',
    body: 'Welcome drinks (kesar badam milk, shikanji), 6 circulating starters, live chaat counter (palak patta, kanji vada), Dal Baati Churma station, Ker Sangri, Gatte ki Sabzi, Paneer Lababdar, assorted rotis, and hot Moong Dal Halwa + Malpua Rabri.',
    source: 'Jaipur Halwai & Catering Benchmark Handbook (Estimate Assumption)',
  },
  {
    id: 'TPL-WED-03',
    event_type: 'wedding',
    region: 'All India',
    kind: 'decor',
    title: 'Heritage Courtyard & Marigold-Brass Palette',
    body: 'Use locally sourced genda (marigold) and rajnigandha strings, brass urlis, block-printed Jaipur tents, and warm amber LED uplighting. Avoid imported orchids in winter outdoor functions to save 22-28% on floral spend.',
    source: 'Sustainable Indian Wedding Decor Manual #04',
  },
  {
    id: 'TPL-WED-04',
    event_type: 'wedding',
    region: 'All India',
    kind: 'permits',
    title: 'Loudspeaker & Late-Night Music Guidance',
    body: 'General guidance: Outdoor amplified sound typically requires local police station intimation and adherence to 10:00 PM outdoor noise limits; indoor banquet halls allow extended hours with acoustic containment.',
    source: 'General Civic Event Guidance Note #11',
  },
  {
    id: 'TPL-WED-05',
    event_type: 'wedding',
    region: 'All India',
    kind: 'run_of_show',
    title: 'Wedding Day Run-of-Show & Buffer Protocol',
    body: 'Maintain a 45-minute buffer between Baraat arrival and varmala stage cue. Assign one family coordinator exclusively for bride/groom hospitality and one exclusively for vendor sign-offs.',
    source: 'Aayojan Run-of-Show Playbook v1.0',
  },
  {
    id: 'TPL-BIR-01',
    event_type: 'birthday',
    region: 'All India',
    kind: 'activities',
    title: 'Age 8–12 Interactive Quest & Maker Stations',
    body: 'Ten-year-olds outgrow passive toddler games. Run a 45-minute team treasure hunt/escape-room puzzle, DIY slime or mini-robotics kit table, and high-energy trivia bingo before cake cutting.',
    source: 'Child Age-Band Activity Compendium (Ages 8-12)',
  },
  {
    id: 'TPL-BIR-02',
    event_type: 'birthday',
    region: 'All India',
    kind: 'menu',
    title: 'Kid-First Finger Food + Adult Evening High Tea',
    body: 'Split counters by height: Kids counter with mini sliders, baked mac-and-cheese cups, fruit skewers, and popcorn; Adult counter with masala chai bar, samosa chaat, hummus wraps, and millet bites. Clearly label nut/dairy allergens.',
    source: 'Family Party Catering Standards v1.1',
  },
  {
    id: 'TPL-BIR-03',
    event_type: 'birthday',
    region: 'All India',
    kind: 'run_of_show',
    title: '3-Hour Birthday Run-of-Show',
    body: '0:00 Welcome & tattoo/craft corner; 0:30 Group games & treasure hunt; 1:15 Magic/Science show; 1:45 Cake cutting & group photo; 2:00 Hot food service; 2:45 Return gift handover.',
    source: 'Aayojan Birthday Timing Template #02',
  },
  {
    id: 'TPL-COM-01',
    event_type: 'community',
    region: 'All India RWA / Civic Grounds',
    kind: 'permits',
    title: 'Community Mela Permit & NOC Checklist',
    body: 'General guidance: Obtain RWA committee resolution, ground booking letter, local police station traffic/crowd intimation, fire safety inspection for temporary pandals/LPG stalls, and temporary electricity connection load approval.',
    source: 'RWA & Civic Festival Operations Checklist #01',
  },
  {
    id: 'TPL-COM-02',
    event_type: 'community',
    region: 'All India',
    kind: 'safety',
    title: 'Diwali Mela Fire, Electrical & Crowd Safety Protocol',
    body: 'Mandatory 3-meter clearance around food stalls using induction/LPG; minimum two 4kg ABC fire extinguishers per 8 stalls; dedicated entry/exit gates with volunteer marshals; illuminated first-aid desk with on-call doctor.',
    source: 'Community Gathering Safety Standard #07',
  },
  {
    id: 'TPL-COM-03',
    event_type: 'community',
    region: 'All India',
    kind: 'run_of_show',
    title: 'Volunteer Roster & Sponsor Tier Structure',
    body: 'Organize volunteers into 3-hour shifts across 4 desks: Gate & Security, Stall Coordination, Stage & Green Room, and Zero-Waste Sanitation. Offer Title, Gold, and Stall Sponsorship tiers to offset 30-40% of infrastructure cost.',
    source: 'Neighborhood Festival Playbook v1.4',
  },
  {
    id: 'TPL-COM-04',
    event_type: 'community',
    region: 'All India',
    kind: 'decor',
    title: 'Eco-Festive Diya, Rangoli & Artisan Stall Layout',
    body: 'Arrange stalls in a U-shaped perimeter with central amphitheater viewing for senior citizens. Use terracotta diyas, fabric torans, and warm LED festoon strings.',
    source: 'Community Cultural Mela Design Guide #03',
  },
];

export interface VendorKitTemplate {
  category: string;
  whatToAsk: string[];
  redFlags: string[];
  benchmarkInclusions: string;
}

export const VENDOR_KITS: Record<string, VendorKitTemplate> = {
  Catering: {
    category: 'Catering',
    whatToAsk: [
      'Is the per-plate rate locked for up to +10% day-of buffer plates?',
      'Are live counters, service staff ratio (1 waiter per 15 guests), and bone-china crockery included?',
      'What is the exact generator/fuel backup responsibility for kitchen warmers?',
    ],
    redFlags: [
      'Demands >50% advance before menu tasting',
      'Separate hidden charges for water bottles, chaffing fuel, or service staff tips',
      'Refuses written schedule of live-counter restocking times',
    ],
    benchmarkInclusions: 'Welcome drinks, 6 starters, 5 mains, 2 live counters, 3 desserts, crockery & service staff',
  },
  Venue: {
    category: 'Venue',
    whatToAsk: [
      'What is the floating vs seated capacity of the lawn + indoor backup hall?',
      'Are outside caterers and decorators allowed without royalty/monopoly fees?',
      'How many hours of generator backup and complimentary bridal/green rooms are included?',
    ],
    redFlags: [
      'Mandatory empanelled decorator with unquoted monopoly markup',
      'No covered indoor rain/cold backup space on the same premises',
      'Unclear corkage or late-night overtime hourly penalty',
    ],
    benchmarkInclusions: 'Lawn + Banquet Hall, 4 green rooms, basic security, valet parking for 80 cars, 6hr power backup',
  },
  'Decor and florals': {
    category: 'Decor and florals',
    whatToAsk: [
      'Can we see real execution photos from the same venue rather than 3D Pinterest renders?',
      'What proportion of florals are fresh local marigold/jasmine vs artificial silk fillers?',
      'Are stage trussing, ambient lawn lighting, and entrance signage included in the lump sum?',
    ],
    redFlags: [
      'Quotes a lump sum without itemizing mandap, entrance, stage, and table centerpieces',
      'Excludes electrical wiring andgenset load for decorative chandeliers',
    ],
    benchmarkInclusions: 'Entrance arch, mandap/stage setup, fresh floral hangings, lounge seating & warm ambient lighting',
  },
  'Photo and video': {
    category: 'Photo and video',
    whatToAsk: [
      'How many candid photographers, traditional photographers, and cinematographers will be on-site per function?',
      'What is the contract delivery timeline for raw cloud gallery vs edited highlight reel?',
      'Do you carry dual-card-slot cameras and on-site SSD backup?',
    ],
    redFlags: [
      'Subcontracts entire shoot to unknown freelancers without disclosure',
      'Holds raw photos hostage for final payment despite 80%+ already paid',
    ],
    benchmarkInclusions: '2 candid + 2 traditional crew, 400 edited photos, 4-min cinematic teaser, full multi-cam film',
  },
  'Venue, permits, infrastructure': {
    category: 'Venue, permits, infrastructure',
    whatToAsk: [
      'Does the tent/infrastructure vendor provide certified fire-retardant fabric and licensed electrician sign-off?',
      'Are barricades, entry arches, and dual silent DG sets included in the ground package?',
      'Who coordinates municipal/police NOC submission timelines?',
    ],
    redFlags: [
      'Open loose electrical cabling across public walkways',
      'No silent generator backup for emergency pathway lighting',
    ],
    benchmarkInclusions: 'Ground leveling, entry gates, stage truss, 62.5 kVA silent DG set, licensed electrical distribution',
  },
};

export function getVendorKit(category: string): VendorKitTemplate {
  if (VENDOR_KITS[category]) return VENDOR_KITS[category];
  return {
    category,
    whatToAsk: [
      `Confirm exact deliverables, arrival time, and setup buffer for ${category}.`,
      'Are GST, transport to venue, and crew meals included in the quoted figure?',
      'What is the cancellation or date-postponement credit policy?',
    ],
    redFlags: [
      'Verbal-only commitments without itemized written scope',
      'Requires 100% payment prior to event day completion',
    ],
    benchmarkInclusions: `Complete ${category.toLowerCase()} package with on-time delivery and setup crew`,
  };
}

export function getDefaultIdeas(type: EventType): EventIdeas {
  if (type === 'wedding') {
    return {
      themes: [
        {
          title: 'Kesariya Courtyard & Brass Heritage',
          description: 'Warm saffron marigolds, hand-block Sanganeri drapes, and antique brass urlis suited for winter Jaipur evenings.',
          estimatedBand: 'Fits Standard ₹10–15L tier',
          templateCitation: 'TPL-WED-03',
        },
        {
          title: 'Moonlit Sheeshmahal Sangeet',
          description: 'Amber fairy canopies, mirror-work cushions, and low-seating diwans with acoustic folk fusion.',
          estimatedBand: 'Fits Standard/Premium tier',
          templateCitation: 'TPL-WED-01',
        },
      ],
      menu: [
        {
          title: 'Jaipur Royal Pangat & Chaat Bazaar',
          description: 'Live Palak Patta Chaat, Kanji Vada, Dal Baati Churma, Gatte ki Sabzi, and hot Kullad Kesar Milk + Malpua Rabri.',
          estimatedBand: '₹1,400–₹1,800 / guest (Estimate)',
          templateCitation: 'TPL-WED-02',
        },
      ],
      games: [
        {
          title: 'Bride vs Groom Musical Antakshari & Shoe Heist',
          description: 'Structured 30-minute family trivia + Joota Chupai negotiation clues hosted by cousins.',
          estimatedBand: 'Zero extra vendor cost',
          templateCitation: 'TPL-WED-01',
        },
      ],
      decor: [
        {
          title: 'Local Genda + Rajnigandha Mandap',
          description: 'Replaces imported exotic stems with high-density local marigold bells and earthen lamps, cutting floral waste by 25%.',
          estimatedBand: '₹1,00,000–₹1,25,000 (Estimate)',
          templateCitation: 'TPL-WED-03',
        },
      ],
      runOfShow: [
        {
          title: '2-Day Multi-Function Master Cue Sheet',
          description: 'Day 1: 12:30 PM Mehendi, 7:00 PM Sangeet (outdoor sound cut at 10:00 PM). Day 2: 10:00 AM Haldi, 4:30 PM Baraat, 6:30 PM Dusk Pheras.',
          estimatedBand: '45-min buffer enforced',
          templateCitation: 'TPL-WED-05',
        },
      ],
    };
  }

  if (type === 'birthday') {
    return {
      themes: [
        {
          title: 'Galactic Explorer & Maker Lab (Age 10)',
          description: 'Constellation backdrop, glow-in-the-dark mission badges, and hands-on puzzle stations.',
          estimatedBand: 'Fits Lean/Standard tier',
          templateCitation: 'TPL-BIR-01',
        },
      ],
      menu: [
        {
          title: 'Split Kid Sliders + Parent Masala Chai High Tea',
          description: 'Nut-free mini burgers, baked fries, and pizza cones for kids; samosa chaat and filter coffee/chai bar for adults.',
          estimatedBand: '₹550–₹850 / guest (Estimate)',
          templateCitation: 'TPL-BIR-02',
        },
      ],
      games: [
        {
          title: '45-Min Mystery Cipher Hunt',
          description: 'Teams of 5 solve 4 clue envelopes hidden around the venue to unlock the treasure chest before cake cutting.',
          estimatedBand: '₹6,000–₹12,000 host & props',
          templateCitation: 'TPL-BIR-01',
        },
      ],
      decor: [
        {
          title: 'Reusable Fabric Arch & Photo Props Board',
          description: 'Custom name board with biodegradable pastel balloons and table activity mats.',
          estimatedBand: '₹8,000–₹15,000 (Estimate)',
          templateCitation: 'TPL-BIR-03',
        },
      ],
      runOfShow: [
        {
          title: 'Tight 3-Hour Party Flow',
          description: '4:30 PM Arrival craft -> 5:00 PM Cipher Hunt -> 5:45 PM Science Show -> 6:15 PM Cake -> 6:30 PM High Tea -> 7:15 PM Return Gifts.',
          estimatedBand: 'Zero dead-time schedule',
          templateCitation: 'TPL-BIR-03',
        },
      ],
    };
  }

  return {
    themes: [
      {
        title: 'Swachh & Surakshit Community Diwali Mela',
        description: 'Zero-plastic terracotta diya lighting, self-help group artisan stalls, and central senior-citizen seating.',
        estimatedBand: 'RWA Sponsor-Supported',
        templateCitation: 'TPL-COM-04',
      },
    ],
    menu: [
      {
        title: 'Regional Chaat, Millet & Sweet Stalls',
        description: '12 curated resident & local FSSAI-verified food stalls with reusable steel plates and RO water stations.',
        estimatedBand: 'Self-sustaining stall fee model',
        templateCitation: 'TPL-COM-01',
      },
    ],
    games: [
      {
        title: 'RWA Tambola, Rangoli Competition & Kids Talent Hour',
        description: 'Staggered 45-minute stage blocks to keep footfall steady from 5:00 PM to 9:30 PM.',
        estimatedBand: 'Sponsor gift vouchers',
        templateCitation: 'TPL-COM-03',
      },
    ],
    decor: [
      {
        title: 'Octonorm U-Layout with Safety Aisles',
        description: '3-meter fire-tender corridor, festive marigold entry gate, and illuminated emergency exit signage.',
        estimatedBand: 'Fits 15% infrastructure allocation',
        templateCitation: 'TPL-COM-02',
      },
    ],
    runOfShow: [
      {
        title: '2-Shift Volunteer & Safety Command Roster',
        description: 'Shift A (4:00–7:00 PM) and Shift B (7:00–10:00 PM) covering Gate, Stalls, Medical Booth, and Waste Segregation.',
        estimatedBand: '20 RWA Volunteers',
        templateCitation: 'TPL-COM-03',
      },
    ],
    permitsAndVolunteers: [
      {
        title: 'Municipal, Police & Fire NOC Sequence',
        description: 'Submit RWA ground intimation 45 days out; inspect fire extinguishers and electrical load 48 hours before gates open.',
        estimatedBand: 'Mandatory statutory compliance',
        templateCitation: 'TPL-COM-01',
      },
    ],
  };
}
