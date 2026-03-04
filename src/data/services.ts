export interface Service {
  name: string;
  slug: string;
}

export interface ServiceCategory {
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  subcategories: {
    name: string;
    services: Service[];
  }[];
}

export const serviceCategories: ServiceCategory[] = [
  {
    name: "Home Improvement",
    slug: "home-improvement",
    icon: "Home",
    color: "category-home",
    description: "From renovations to repairs, find trusted pros for every home project.",
    subcategories: [
      {
        name: "Additions & Remodels",
        services: [
          { name: "Basement Remodel", slug: "basement-remodel" },
          { name: "Bathroom Remodel", slug: "bathroom-remodel" },
          { name: "Kitchen Remodel", slug: "kitchen-remodel" },
          { name: "Deck Construction", slug: "deck-construction" },
          { name: "Garage Conversion", slug: "garage-conversion" },
          { name: "Patio Construction", slug: "patio-construction" },
          { name: "Pergola Construction", slug: "pergola-construction" },
          { name: "Sunroom Addition", slug: "sunroom-addition" },
          { name: "Home Addition", slug: "home-addition" },
          { name: "Basement Finishing", slug: "basement-finishing" },
        ],
      },
      {
        name: "Plumbing",
        services: [
          { name: "Plumber", slug: "plumber" },
          { name: "Drain Cleaning", slug: "drain-cleaning" },
          { name: "Water Heater Installation", slug: "water-heater-install" },
          { name: "Pipe Repair", slug: "pipe-repair" },
          { name: "Sump Pump Installation", slug: "sump-pump" },
          { name: "Toilet Repair", slug: "toilet-repair" },
          { name: "Septic Tank Services", slug: "septic-tank" },
          { name: "Tankless Water Heater", slug: "tankless-water-heater" },
          { name: "Water Softener Installation", slug: "water-softener" },
          { name: "Frozen Pipe Thawing", slug: "frozen-pipe-thawing" },
        ],
      },
      {
        name: "Electrical",
        services: [
          { name: "Electrician", slug: "electrician" },
          { name: "Ceiling Fan Installation", slug: "ceiling-fan-install" },
          { name: "Solar Panel Installation", slug: "solar-panel" },
          { name: "Generator Installation", slug: "generator-install" },
          { name: "EV Charger Installation", slug: "ev-charger" },
          { name: "Hot Tub Wiring", slug: "hot-tub-wiring" },
          { name: "Panel Upgrade", slug: "panel-upgrade" },
          { name: "Recessed Lighting", slug: "recessed-lighting" },
        ],
      },
      {
        name: "Heating & Cooling",
        services: [
          { name: "HVAC System", slug: "hvac-system" },
          { name: "Furnace Repair", slug: "furnace-repair" },
          { name: "Furnace Replacement", slug: "furnace-replacement" },
          { name: "AC Repair", slug: "ac-repair" },
          { name: "Air Duct Cleaning", slug: "air-duct-cleaning" },
          { name: "Heat Pump Installation", slug: "heat-pump" },
          { name: "Fireplace Installation", slug: "fireplace-install" },
          { name: "Chimney Sweep", slug: "chimney-sweep" },
          { name: "Insulation", slug: "insulation" },
          { name: "Radiant Floor Heating", slug: "radiant-floor-heating" },
          { name: "Wood Stove Installation", slug: "wood-stove" },
          { name: "Geothermal Heating", slug: "geothermal" },
        ],
      },
      {
        name: "Roofing",
        services: [
          { name: "Roof Repair", slug: "roof-repair" },
          { name: "Roof Replacement", slug: "roof-replacement" },
          { name: "Metal Roofing", slug: "metal-roofing" },
          { name: "Shingle Roofing", slug: "shingle-roofing" },
          { name: "Ice Dam Removal", slug: "ice-dam-removal" },
          { name: "Roof Snow Removal", slug: "roof-snow-removal" },
        ],
      },
      {
        name: "Windows & Doors",
        services: [
          { name: "Window Replacement", slug: "window-replacement" },
          { name: "Window Repair", slug: "window-repair" },
          { name: "Door Installation", slug: "door-install" },
          { name: "Garage Door Repair", slug: "garage-door-repair" },
          { name: "Storm Door Installation", slug: "storm-door" },
          { name: "Window Winterization", slug: "window-winterization" },
        ],
      },
      {
        name: "Flooring",
        services: [
          { name: "Hardwood Flooring", slug: "hardwood-flooring" },
          { name: "Carpet Installation", slug: "carpet-install" },
          { name: "Laminate Flooring", slug: "laminate-flooring" },
          { name: "Tile Installation", slug: "tile-install" },
          { name: "Vinyl Flooring", slug: "vinyl-flooring" },
          { name: "Heated Floor Installation", slug: "heated-floors" },
        ],
      },
      {
        name: "Painting",
        services: [
          { name: "Interior Painting", slug: "interior-painting" },
          { name: "Exterior Painting", slug: "exterior-painting" },
          { name: "Deck Staining", slug: "deck-staining" },
          { name: "Cabinet Painting", slug: "cabinet-painting" },
          { name: "Wallpaper Installation", slug: "wallpaper-install" },
        ],
      },
      {
        name: "Fencing",
        services: [
          { name: "Fence Installation", slug: "fence-install" },
          { name: "Fence Repair", slug: "fence-repair" },
          { name: "Privacy Fence", slug: "privacy-fence" },
          { name: "Chain Link Fence", slug: "chain-link-fence" },
        ],
      },
    ],
  },
  {
    name: "Outdoor & Seasonal",
    slug: "outdoor-seasonal",
    icon: "TreePine",
    color: "category-outdoor",
    description: "Canadian weather-ready services — snow removal, landscaping, and more.",
    subcategories: [
      {
        name: "Snow & Ice Services",
        services: [
          { name: "Snow Plowing", slug: "snow-plowing" },
          { name: "Snow Removal", slug: "snow-removal" },
          { name: "Ice Dam Removal", slug: "ice-dam-removal" },
          { name: "Driveway Salting", slug: "driveway-salting" },
          { name: "Roof Snow Removal", slug: "roof-snow-removal" },
          { name: "Sidewalk Snow Clearing", slug: "sidewalk-snow-clearing" },
          { name: "Commercial Snow Removal", slug: "commercial-snow-removal" },
        ],
      },
      {
        name: "Landscaping",
        services: [
          { name: "Landscaping Design", slug: "landscaping-design" },
          { name: "Lawn Care", slug: "lawn-care" },
          { name: "Tree Trimming", slug: "tree-trimming" },
          { name: "Tree Removal", slug: "tree-removal" },
          { name: "Stump Grinding", slug: "stump-grinding" },
          { name: "Sod Installation", slug: "sod-install" },
          { name: "Garden Design", slug: "garden-design" },
          { name: "Sprinkler System", slug: "sprinkler-system" },
          { name: "Leaf Cleanup", slug: "leaf-cleanup" },
          { name: "Spring Cleanup", slug: "spring-cleanup" },
          { name: "Fall Cleanup", slug: "fall-cleanup" },
        ],
      },
      {
        name: "Pools & Hot Tubs",
        services: [
          { name: "Pool Installation", slug: "pool-install" },
          { name: "Pool Cleaning", slug: "pool-cleaning" },
          { name: "Pool Winterization", slug: "pool-winterization" },
          { name: "Hot Tub Installation", slug: "hot-tub-install" },
          { name: "Hot Tub Repair", slug: "hot-tub-repair" },
          { name: "Pool Opening (Spring)", slug: "pool-opening" },
        ],
      },
      {
        name: "Outdoor Structures",
        services: [
          { name: "Deck Building", slug: "deck-building" },
          { name: "Gazebo Construction", slug: "gazebo" },
          { name: "Shed Construction", slug: "shed-construction" },
          { name: "Patio Cover", slug: "patio-cover" },
        ],
      },
      {
        name: "Driveways & Paving",
        services: [
          { name: "Asphalt Driveway", slug: "asphalt-driveway" },
          { name: "Concrete Driveway", slug: "concrete-driveway" },
          { name: "Driveway Sealing", slug: "driveway-sealing" },
          { name: "Interlock Installation", slug: "interlock-install" },
          { name: "Heated Driveway", slug: "heated-driveway" },
        ],
      },
    ],
  },
  {
    name: "Cleaning",
    slug: "cleaning",
    icon: "Sparkles",
    color: "category-cleaning",
    description: "Professional cleaning for homes, offices, and specialized surfaces.",
    subcategories: [
      {
        name: "Home Cleaning",
        services: [
          { name: "House Cleaning", slug: "house-cleaning" },
          { name: "Deep Cleaning", slug: "deep-cleaning" },
          { name: "Move-In/Out Cleaning", slug: "move-in-out-cleaning" },
          { name: "Apartment Cleaning", slug: "apartment-cleaning" },
          { name: "Carpet Cleaning", slug: "carpet-cleaning" },
          { name: "Window Cleaning", slug: "window-cleaning" },
          { name: "Upholstery Cleaning", slug: "upholstery-cleaning" },
          { name: "Oven Cleaning", slug: "oven-cleaning" },
        ],
      },
      {
        name: "Commercial Cleaning",
        services: [
          { name: "Office Cleaning", slug: "office-cleaning" },
          { name: "Commercial Cleaning", slug: "commercial-cleaning" },
          { name: "Post-Construction Cleanup", slug: "post-construction-cleanup" },
        ],
      },
      {
        name: "Specialty Cleaning",
        services: [
          { name: "Power Washing", slug: "power-washing" },
          { name: "Gutter Cleaning", slug: "gutter-cleaning" },
          { name: "Duct Cleaning", slug: "duct-cleaning" },
          { name: "Dryer Vent Cleaning", slug: "dryer-vent-cleaning" },
          { name: "Solar Panel Cleaning", slug: "solar-panel-cleaning" },
        ],
      },
      {
        name: "Restoration",
        services: [
          { name: "Water Damage Restoration", slug: "water-damage" },
          { name: "Fire Damage Restoration", slug: "fire-damage" },
          { name: "Mold Removal", slug: "mold-removal" },
        ],
      },
      {
        name: "Junk & Waste",
        services: [
          { name: "Junk Removal", slug: "junk-removal" },
          { name: "Dumpster Rental", slug: "dumpster-rental" },
          { name: "Furniture Removal", slug: "furniture-removal" },
        ],
      },
    ],
  },
  {
    name: "Business Services",
    slug: "business",
    icon: "Briefcase",
    color: "category-business",
    description: "Legal, financial, marketing, and IT support for Canadian businesses.",
    subcategories: [
      {
        name: "Legal",
        services: [
          { name: "Small Business Lawyer", slug: "small-business-lawyer" },
          { name: "Real Estate Lawyer", slug: "real-estate-lawyer" },
          { name: "Immigration Lawyer", slug: "immigration-lawyer" },
          { name: "Family Lawyer", slug: "family-lawyer" },
          { name: "Criminal Defence Lawyer", slug: "criminal-defence-lawyer" },
          { name: "Notary Public", slug: "notary-public" },
          { name: "Will & Estate Planning", slug: "will-estate-planning" },
          { name: "Divorce Lawyer", slug: "divorce-lawyer" },
          { name: "Employment Lawyer", slug: "employment-lawyer" },
          { name: "Tax Lawyer", slug: "tax-lawyer" },
        ],
      },
      {
        name: "Finance & Accounting",
        services: [
          { name: "Accountant", slug: "accountant" },
          { name: "Tax Preparation", slug: "tax-preparation" },
          { name: "Bookkeeper", slug: "bookkeeper" },
          { name: "Financial Advisor", slug: "financial-advisor" },
          { name: "Mortgage Broker", slug: "mortgage-broker" },
          { name: "Payroll Services", slug: "payroll" },
        ],
      },
      {
        name: "Marketing & Design",
        services: [
          { name: "Social Media Marketing", slug: "social-media-marketing" },
          { name: "Graphic Design", slug: "graphic-design" },
          { name: "Web Development", slug: "web-development" },
          { name: "SEO Services", slug: "seo-services" },
          { name: "Advertising", slug: "advertising" },
          { name: "Freelance Writing", slug: "freelance-writing" },
          { name: "Resume Writing", slug: "resume-writing" },
          { name: "Translation (French/English)", slug: "translation" },
        ],
      },
      {
        name: "IT & Tech",
        services: [
          { name: "Tech Support", slug: "tech-support" },
          { name: "Computer Repair", slug: "computer-repair" },
          { name: "Data Recovery", slug: "data-recovery" },
          { name: "iPhone/iPad Repair", slug: "phone-repair" },
          { name: "Network Setup", slug: "network-setup" },
          { name: "Cybersecurity Consulting", slug: "cybersecurity" },
        ],
      },
      {
        name: "Consulting",
        services: [
          { name: "Small Business Consulting", slug: "business-consulting" },
          { name: "HR Consulting", slug: "hr-consulting" },
          { name: "Recruiting", slug: "recruiting" },
          { name: "Private Investigation", slug: "private-investigation" },
        ],
      },
    ],
  },
  {
    name: "Events & Entertainment",
    slug: "events",
    icon: "PartyPopper",
    color: "category-events",
    description: "Plan unforgettable events with photography, catering, and entertainment pros.",
    subcategories: [
      {
        name: "Photography & Video",
        services: [
          { name: "Wedding Photographer", slug: "wedding-photographer" },
          { name: "Event Photographer", slug: "event-photographer" },
          { name: "Portrait Photography", slug: "portrait-photography" },
          { name: "Real Estate Photography", slug: "real-estate-photography" },
          { name: "Videographer", slug: "videographer" },
          { name: "Drone Photography", slug: "drone-photography" },
          { name: "Video Editing", slug: "video-editing" },
        ],
      },
      {
        name: "Music & Entertainment",
        services: [
          { name: "DJ", slug: "dj" },
          { name: "Live Band", slug: "live-band" },
          { name: "Musician", slug: "musician" },
          { name: "Face Painting", slug: "face-painting" },
          { name: "Caricature Artist", slug: "caricature" },
          { name: "Comedian", slug: "comedian" },
        ],
      },
      {
        name: "Catering & Food",
        services: [
          { name: "Catering", slug: "catering" },
          { name: "Wedding Catering", slug: "wedding-catering" },
          { name: "Food Truck", slug: "food-truck" },
          { name: "Cake Baker", slug: "cake-baker" },
          { name: "Private Chef", slug: "private-chef" },
          { name: "Bartender", slug: "bartender" },
        ],
      },
      {
        name: "Planning",
        services: [
          { name: "Wedding Planner", slug: "wedding-planner" },
          { name: "Event Planner", slug: "event-planner" },
          { name: "Wedding Officiant", slug: "wedding-officiant" },
          { name: "Travel Agent", slug: "travel-agent" },
        ],
      },
      {
        name: "Rentals",
        services: [
          { name: "Photo Booth Rental", slug: "photo-booth" },
          { name: "Bouncy Castle Rental", slug: "bouncy-castle" },
          { name: "Party Bus", slug: "party-bus" },
          { name: "Limousine", slug: "limousine" },
          { name: "Charter Bus", slug: "charter-bus" },
        ],
      },
      {
        name: "Beauty & Fashion",
        services: [
          { name: "Makeup Artist", slug: "makeup-artist" },
          { name: "Hair Stylist", slug: "hair-stylist" },
          { name: "Wedding Hair & Makeup", slug: "wedding-beauty" },
          { name: "Henna Artist", slug: "henna-artist" },
          { name: "Seamstress & Tailoring", slug: "seamstress" },
        ],
      },
    ],
  },
  {
    name: "Lessons & Tutoring",
    slug: "lessons",
    icon: "GraduationCap",
    color: "category-lessons",
    description: "Music, language, sports, and academic tutoring across Canada.",
    subcategories: [
      {
        name: "Music",
        services: [
          { name: "Piano Lessons", slug: "piano-lessons" },
          { name: "Guitar Lessons", slug: "guitar-lessons" },
          { name: "Voice Lessons", slug: "voice-lessons" },
          { name: "Drum Lessons", slug: "drum-lessons" },
          { name: "Piano Tuning", slug: "piano-tuning" },
        ],
      },
      {
        name: "Academic",
        services: [
          { name: "Math Tutor", slug: "math-tutor" },
          { name: "Science Tutor", slug: "science-tutor" },
          { name: "French Tutor", slug: "french-tutor" },
          { name: "English Tutor", slug: "english-tutor" },
          { name: "University Prep", slug: "university-prep" },
        ],
      },
      {
        name: "Language",
        services: [
          { name: "French Lessons", slug: "french-lessons" },
          { name: "English (ESL)", slug: "esl" },
          { name: "Spanish Lessons", slug: "spanish-lessons" },
          { name: "Mandarin Lessons", slug: "mandarin-lessons" },
        ],
      },
      {
        name: "Sports & Fitness",
        services: [
          { name: "Hockey Coaching", slug: "hockey-coaching" },
          { name: "Swimming Lessons", slug: "swimming-lessons" },
          { name: "Tennis Lessons", slug: "tennis-lessons" },
          { name: "Skiing Lessons", slug: "skiing-lessons" },
          { name: "Snowboarding Lessons", slug: "snowboarding-lessons" },
          { name: "Self-Defence Classes", slug: "self-defence" },
          { name: "Dance Lessons", slug: "dance-lessons" },
          { name: "Horseback Riding", slug: "horseback-riding" },
        ],
      },
      {
        name: "Driving",
        services: [
          { name: "Driving Lessons", slug: "driving-lessons" },
          { name: "Winter Driving Course", slug: "winter-driving" },
        ],
      },
    ],
  },
  {
    name: "Pets",
    slug: "pets",
    icon: "PawPrint",
    color: "category-pets",
    description: "Grooming, sitting, training, and everything for your furry friends.",
    subcategories: [
      {
        name: "Pet Care",
        services: [
          { name: "Dog Walking", slug: "dog-walking" },
          { name: "Dog Sitting", slug: "dog-sitting" },
          { name: "Cat Sitting", slug: "cat-sitting" },
          { name: "Pet Sitting", slug: "pet-sitting" },
          { name: "Doggy Daycare", slug: "doggy-daycare" },
          { name: "Dog Boarding", slug: "dog-boarding" },
          { name: "Cat Boarding", slug: "cat-boarding" },
        ],
      },
      {
        name: "Grooming & Training",
        services: [
          { name: "Dog Grooming", slug: "dog-grooming" },
          { name: "Cat Grooming", slug: "cat-grooming" },
          { name: "Dog Training", slug: "dog-training" },
          { name: "Puppy Training", slug: "puppy-training" },
        ],
      },
      {
        name: "Other",
        services: [
          { name: "Invisible Dog Fence", slug: "invisible-fence" },
          { name: "Aquarium Setup", slug: "aquarium-setup" },
        ],
      },
    ],
  },
  {
    name: "Wellness",
    slug: "wellness",
    icon: "Heart",
    color: "category-wellness",
    description: "Personal training, therapy, coaching, and spa services.",
    subcategories: [
      {
        name: "Fitness",
        services: [
          { name: "Personal Trainer", slug: "personal-trainer" },
          { name: "Yoga Instructor", slug: "yoga-instructor" },
          { name: "Pilates Instructor", slug: "pilates-instructor" },
          { name: "Physical Therapy", slug: "physical-therapy" },
        ],
      },
      {
        name: "Coaching & Counselling",
        services: [
          { name: "Life Coach", slug: "life-coach" },
          { name: "Health Coach", slug: "health-coach" },
          { name: "Nutritionist", slug: "nutritionist" },
          { name: "Therapist / Counsellor", slug: "therapist" },
          { name: "Marriage Counselling", slug: "marriage-counselling" },
        ],
      },
      {
        name: "Spa & Beauty",
        services: [
          { name: "Facial Treatment", slug: "facial" },
          { name: "Massage Therapy", slug: "massage-therapy" },
          { name: "Microdermabrasion", slug: "microdermabrasion" },
          { name: "Chemical Peel", slug: "chemical-peel" },
        ],
      },
      {
        name: "Alternative",
        services: [
          { name: "Reiki", slug: "reiki" },
          { name: "Acupuncture", slug: "acupuncture" },
          { name: "Naturopath", slug: "naturopath" },
        ],
      },
    ],
  },
  {
    name: "Moving & Storage",
    slug: "moving",
    icon: "Truck",
    color: "category-automotive",
    description: "Local and long-distance movers, packing, and storage solutions.",
    subcategories: [
      {
        name: "Moving",
        services: [
          { name: "Local Moving", slug: "local-moving" },
          { name: "Long Distance Moving", slug: "long-distance-moving" },
          { name: "Packing Services", slug: "packing-services" },
          { name: "Piano Moving", slug: "piano-moving" },
          { name: "Hot Tub Moving", slug: "hot-tub-moving" },
          { name: "Furniture Moving", slug: "furniture-moving" },
          { name: "Pool Table Moving", slug: "pool-table-moving" },
        ],
      },
      {
        name: "Assembly & Installation",
        services: [
          { name: "Furniture Assembly", slug: "furniture-assembly" },
          { name: "IKEA Assembly", slug: "ikea-assembly" },
          { name: "TV Mounting", slug: "tv-mounting" },
          { name: "Appliance Installation", slug: "appliance-install" },
        ],
      },
    ],
  },
  {
    name: "Home Security & Inspection",
    slug: "security-inspection",
    icon: "Shield",
    color: "category-tech",
    description: "Home inspections, security systems, pest control, and safety services.",
    subcategories: [
      {
        name: "Security",
        services: [
          { name: "Security System Installation", slug: "security-system" },
          { name: "Security Camera Installation", slug: "security-camera" },
          { name: "Locksmith", slug: "locksmith" },
          { name: "Security Guard", slug: "security-guard" },
        ],
      },
      {
        name: "Inspections",
        services: [
          { name: "Home Inspection", slug: "home-inspection" },
          { name: "Mold Inspection", slug: "mold-inspection" },
          { name: "Radon Testing", slug: "radon-testing" },
          { name: "Asbestos Testing", slug: "asbestos-testing" },
          { name: "Energy Audit", slug: "energy-audit" },
          { name: "Chimney Inspection", slug: "chimney-inspection" },
          { name: "Well Inspection", slug: "well-inspection" },
          { name: "Land Survey", slug: "land-survey" },
        ],
      },
      {
        name: "Pest Control",
        services: [
          { name: "Exterminator", slug: "exterminator" },
          { name: "Bed Bug Treatment", slug: "bed-bug-treatment" },
          { name: "Rodent Removal", slug: "rodent-removal" },
          { name: "Wildlife Removal", slug: "wildlife-removal" },
          { name: "Termite Treatment", slug: "termite-treatment" },
          { name: "Wasp/Bee Removal", slug: "wasp-bee-removal" },
        ],
      },
      {
        name: "Property",
        services: [
          { name: "Home Appraisal", slug: "home-appraisal" },
          { name: "Property Management", slug: "property-management" },
          { name: "Real Estate Agent", slug: "real-estate-agent" },
        ],
      },
    ],
  },
];

export function getAllServices(): (Service & { category: string; categorySlug: string; subcategory: string })[] {
  const all: (Service & { category: string; categorySlug: string; subcategory: string })[] = [];
  serviceCategories.forEach((cat) => {
    cat.subcategories.forEach((sub) => {
      sub.services.forEach((svc) => {
        all.push({ ...svc, category: cat.name, categorySlug: cat.slug, subcategory: sub.name });
      });
    });
  });
  return all;
}

export function getTotalServiceCount(): number {
  return getAllServices().length;
}
