import type {
  CoshhAssessment,
  Licence,
  LiftingPlan,
  ProcurementItem,
  SiteInduction,
  SubcontractorQuestionnaire,
} from "./documents";
import type { Project } from "./types";

/**
 * Base content for the document set.
 *
 * These are starting points a production manager edits, not documents to issue
 * unread. Where content is genuinely specific to a job — a substance's actual
 * safety data sheet, a real load weight — the default is a marked placeholder
 * rather than an invented value, because a plausible wrong number in a safety
 * document is worse than an obvious blank.
 */

export const PLACEHOLDER = "[COMPLETE BEFORE ISSUE]";

/**
 * COSHH assessment for water-based haze fluid.
 *
 * The source method statement commits to "COSHH assessment implemented" and
 * "only approved fluids used with safety data sheets available" for haze, but
 * the pack contains no such assessment. Hazard statements and exposure limits
 * must be taken from the actual product's safety data sheet, so they are
 * marked rather than guessed — glycol-based and glycerine-based fluids differ.
 */
export function hazeFluidCoshh(assessedBy: string, assessedOn: string): CoshhAssessment {
  return {
    substance: "Water-based haze fluid",
    supplier: PLACEHOLDER,
    sdsReference: `${PLACEHOLDER} — attach the supplier's current safety data sheet`,
    hazardStatements: [
      `${PLACEHOLDER} — transcribe the H-statements from section 2 of the safety data sheet`,
    ],
    exposureRoutes: ["Inhalation of airborne mist", "Eye contact", "Skin contact"],
    personsExposed:
      "Performers and crew on stage during effect operation; audience in the auditorium; technicians during refilling.",
    workplaceExposureLimit: `${PLACEHOLDER} — check the safety data sheet against EH40 workplace exposure limits`,
    controls: [
      "Only fluid approved by the machine manufacturer is used. Substituting fluid voids the assessment.",
      "Machine positioned so output is not directed at performers' breathing zone.",
      "Venue ventilation confirmed adequate before use, and running during the effect.",
      "Output kept to the minimum needed for the lighting effect.",
      "Fire detection isolated only with the venue's written approval, and reinstated immediately after.",
      "Operated only by trained technicians.",
      "Performers and crew told in advance that haze will be used, and asked to declare respiratory conditions in confidence.",
      "Refilling carried out with the machine cold and powered down.",
    ],
    ppe: [
      "Nitrile gloves when handling or decanting fluid",
      "Eye protection when refilling",
    ],
    storage:
      "Sealed original containers, upright, away from heat and ignition sources. Not decanted into unlabelled containers.",
    disposal:
      "Do not pour into surface water drains. Dispose of surplus fluid and empty containers per the safety data sheet and local authority requirements.",
    spillageProcedure:
      "Contain the spill and absorb with inert material. Floors become slippery when fluid is spilt, so isolate the area and warn others before cleaning. Ventilate. Dispose of absorbent as contaminated waste.",
    firstAid: [
      {
        route: "Inhalation",
        action:
          "Move to fresh air. If breathing is difficult or irritation persists, get medical attention.",
      },
      {
        route: "Eye contact",
        action:
          "Rinse with clean water for at least 15 minutes, holding the eyelids open. Get medical attention if irritation persists.",
      },
      { route: "Skin contact", action: "Wash with soap and water. Remove contaminated clothing." },
      {
        route: "Ingestion",
        action: "Do not induce vomiting. Rinse mouth and get medical attention.",
      },
    ],
    fireFighting: `${PLACEHOLDER} — take suitable extinguishing media from section 5 of the safety data sheet`,
    assessedBy,
    assessedOn,
  };
}

/**
 * Lifting plan skeleton.
 *
 * Under LOLER 1998 every lifting operation is planned by an appointed person,
 * so the plan opens by demanding a name. Loads and equipment are left empty:
 * the app checks the arithmetic once real figures are entered, and inventing
 * weights would defeat that check.
 */
export function baseLiftingPlan(appointedPerson: string, plannedOn: string): LiftingPlan {
  return {
    appointedPerson: appointedPerson || PLACEHOLDER,
    liftCategory: "Standard",
    description: `${PLACEHOLDER} — describe what is being lifted, from where, to where`,
    loads: [],
    equipment: [],
    groundConditions:
      "Confirm the floor or ground can take the point loads imposed, including outrigger loads. Check for voids, basements and service ducts beneath the lift area.",
    exclusionZone:
      "Area beneath and around the load kept clear of all persons not involved in the lift. Barriers and signage in place before the lift begins.",
    communications:
      "One appointed signaller. Agreed hand signals or radio channel confirmed before the lift. The lift stops if communication is lost.",
    weatherLimits:
      "Outdoor lifts stop if wind speed exceeds the equipment manufacturer's limit, or in lightning or reduced visibility. Wind speed measured, not estimated.",
    sequence: [
      "Confirm the appointed person is present and the plan has been briefed to everyone involved.",
      "Check equipment certification is in date and inspect for damage before use.",
      "Confirm load weight and attachment points against this plan.",
      "Establish and confirm the exclusion zone.",
      "Trial lift a few inches, hold, and confirm stability and balance before continuing.",
      "Complete the lift under the signaller's direction.",
      "Land, secure and release the load before dismantling.",
    ],
    emergencyProcedure:
      "If the load becomes unstable, stop and lower it to the nearest safe position if it is safe to do so. Do not attempt to correct a swinging load by hand. Keep the exclusion zone clear until the load is landed and secure.",
    plannedBy: appointedPerson || PLACEHOLDER,
    plannedOn,
  };
}

/**
 * Site induction.
 *
 * The method statement's first stage is "Arrival & Induction — Venue briefing
 * and hazard review", which needs a record that it happened and who attended.
 */
export function baseSiteInduction(project: Project, inductedBy: string): SiteInduction {
  return {
    venue: project.venues[0] ?? PLACEHOLDER,
    inductedBy: inductedBy || PLACEHOLDER,
    briefingPoints: [
      {
        topic: "The work",
        detail: `${project.name}: load-in, installation, operation and get-out.`,
      },
      {
        topic: "Significant hazards",
        detail:
          "Manual handling, work at height, moving vehicles at the loading door, trailing cables, and overhead work. See the risk assessment for this job.",
      },
      {
        topic: "Fire and evacuation",
        detail:
          "Alarm tone, evacuation routes from the working areas, and the assembly point. Fire exits and routes stay clear at all times.",
      },
      { topic: "First aid", detail: "Who the first aiders are, where the kit is, nearest A&E." },
      {
        topic: "Accident and near miss reporting",
        detail:
          "Report everything, including near misses, to the production manager. Near misses trigger a review of the risk assessment.",
      },
      {
        topic: "PPE",
        detail:
          "Safety footwear at all times in working areas. Gloves for handling. Head protection where work is going on overhead. High-visibility clothing at the loading door.",
      },
      {
        topic: "Permits and restricted areas",
        detail:
          "Areas requiring venue permission, including any work affecting fire detection, rigging positions or power distribution.",
      },
      {
        topic: "Welfare",
        detail: "Toilets, water, break arrangements and working hours.",
      },
      {
        topic: "Stop work authority",
        detail:
          "Anyone may stop work if they believe it is unsafe, without needing permission and without consequence.",
      },
    ],
    emergencyArrangements: [
      "Alarm raised by nearest call point",
      "Evacuate by the nearest safe exit, do not use lifts",
      "Assembly point confirmed at induction",
      "Production manager accounts for the crew",
      "Nobody re-enters until the venue confirms it is safe",
    ],
    attendeeRoles: [
      "Production Manager",
      "Technical Manager",
      "Stage Manager",
      "Crew",
      "Contractor",
      "Driver",
    ],
  };
}

/**
 * Subcontractor pre-qualification questionnaire.
 *
 * Sent out and returned before a subcontractor is added to the approved
 * supplier register. The questions are the ones whose answers a client's
 * safety officer will eventually ask you for.
 */
export const SUBCONTRACTOR_QUESTIONNAIRE: SubcontractorQuestionnaire = {
  sections: [
    {
      heading: "1. Company details",
      questions: [
        "Registered company name and number",
        "Trading address and registered address",
        "Main contact, position, telephone and email",
        "Years trading, and trading names previously used",
        "VAT registration number",
      ],
    },
    {
      heading: "2. Insurance",
      questions: [
        "Employers' liability insurer, policy number, limit and expiry date",
        "Public liability insurer, policy number, limit and expiry date",
        "Professional indemnity cover, where applicable",
        "Attach current certificates for each",
      ],
    },
    {
      heading: "3. Health and safety management",
      questions: [
        "Do you have a written health and safety policy? Attach it if you employ five or more people.",
        "Who is your competent health and safety adviser?",
        "How do you produce risk assessments and method statements?",
        "How do you brief your staff on site-specific risks?",
      ],
    },
    {
      heading: "4. Competence and training",
      questions: [
        "What training records do you hold for staff working on this contract?",
        "List relevant certification: IPAF, PASMA, LOLER appointed person, first aid, electrical competence.",
        "How do you verify the competence of any labour you subcontract?",
      ],
    },
    {
      heading: "5. Accident history",
      questions: [
        "RIDDOR reportable incidents in the last three years, with dates and outcomes",
        "Any enforcement action, improvement or prohibition notices, or prosecutions in the last five years",
      ],
    },
    {
      heading: "6. Equipment",
      questions: [
        "How is your lifting and access equipment inspected and certified?",
        "How do you record PAT testing of electrical equipment?",
        "Who maintains your equipment and how often?",
      ],
    },
    {
      heading: "7. Accreditations and references",
      questions: [
        "Trade body memberships and accreditations, with membership numbers",
        "Two references for work of comparable scale in the last two years",
      ],
    },
    {
      heading: "8. Declaration",
      questions: [
        "I confirm the information given is accurate and that we will notify any material change, including a lapse in insurance cover.",
        "Signed, name, position, date",
      ],
    },
  ],
};

/**
 * Licences and permissions commonly needed for live event and install work.
 *
 * Seeded as "not started" with no reference, so the register is a checklist
 * to work through rather than a claim that anything has been obtained. Which
 * of these apply depends entirely on the job and the venue.
 */
export function baseLicenceRegister(owner: string): Licence[] {
  const item = (name: string, authority: string, notes: string): Licence => ({
    name,
    authority,
    reference: "",
    owner: owner || PLACEHOLDER,
    status: "not-started",
    notes,
  });

  return [
    item(
      "Premises licence / venue licence check",
      "Venue or local authority",
      "Confirm the venue's licence covers this activity, capacity and finishing time. Usually the venue holds it — get it in writing.",
    ),
    item(
      "Temporary event notice",
      "Local authority licensing",
      "Only where the venue is unlicensed or the activity falls outside its licence. Statutory notice period applies, so check early.",
    ),
    item(
      "Road closure or highway licence",
      "Local authority highways",
      "For any load-in that occupies the highway or footway, including cranes and cherry pickers. Long lead time.",
    ),
    item(
      "Parking suspension / dispensation",
      "Local authority",
      "For production vehicles and artic access at the loading door.",
    ),
    item(
      "Pyrotechnics or flame permission",
      "Venue and local fire authority",
      "Needs the venue's written agreement plus the operator's competence evidence. Not applicable unless the show uses flame or pyro.",
    ),
    item(
      "Fire detection isolation permit",
      "Venue",
      "Required wherever haze or smoke may trigger detection. The method statement commits to venue approval before isolating.",
    ),
    item(
      "Drone flight permission",
      "Civil Aviation Authority and landowner",
      "Only if aerial filming is planned. Operator ID and flyer ID required.",
    ),
    item(
      "Music licensing",
      "PPL PRS",
      "Confirm whether the venue's licence covers the performance or whether a separate licence is needed.",
    ),
    item(
      "Child performance licence",
      "Local authority of the child's residence",
      "Required for performers of compulsory school age. Applies per child, with a statutory notice period, and a chaperone ratio.",
    ),
    item(
      "Waste carrier registration",
      "Environment Agency",
      "Needed if you remove waste from site yourself rather than using the venue's contractor.",
    ),
  ];
}

/**
 * Procurement schedule seeded from the method statement's plant list.
 *
 * Budgets are zero and suppliers blank on purpose: an invented budget becomes
 * a number someone quotes against. Lead times are conservative defaults to be
 * confirmed with the supplier.
 */
export function baseProcurementSchedule(requiredOnSite: string): ProcurementItem[] {
  const item = (name: string, leadTimeDays: number): ProcurementItem => ({
    item: name,
    supplier: "",
    leadTimeDays,
    requiredOnSite,
    budgetPence: 0,
    status: "to-order",
  });

  return [
    item("Lighting and rigging hire", 10),
    item("Audio system hire", 10),
    item("Set and staging build", 20),
    item("Access equipment hire (towers, podium steps)", 5),
    item("Power distribution and cabling", 10),
    item("Haze fluid (approved for the machine in use)", 5),
    item("Transport and vehicle hire", 10),
    item("Crew and local labour call", 15),
    item("Consumables (tape, fixings, ties)", 5),
    item("Waste and recycling collection", 5),
  ];
}

/**
 * Production schedule phases, from the method statement's method of work.
 *
 * Dates are derived from the project's own start and end, so the schedule is
 * roughed out rather than blank, and the phase order matches the RAMS.
 */
export const SCHEDULE_PHASES = [
  { name: "Design and planning", owner: "Production Manager", share: 0 },
  { name: "Procurement and hire", owner: "Production Manager", share: 0 },
  { name: "Workshop build", owner: "Technical Manager", share: 0 },
  { name: "Transport to venue", owner: "Production Manager", share: 0 },
  { name: "Arrival and induction", owner: "Production Manager", share: 0 },
  { name: "Load-in", owner: "Technical Manager", share: 0 },
  { name: "Installation", owner: "Technical Manager", share: 0 },
  { name: "Testing and focus", owner: "Technical Manager", share: 0 },
  { name: "Performance", owner: "Stage Manager", share: 0 },
  { name: "Get-out", owner: "Technical Manager", share: 0 },
  { name: "Return and derig", owner: "Production Manager", share: 0 },
] as const;

export const SUPPLIER_CATEGORIES = [
  "Lighting",
  "Audio",
  "Video",
  "Rigging",
  "Set and scenic",
  "Staging",
  "Transport",
  "Access equipment",
  "Power",
  "Crew and labour",
  "Waste",
  "Consumables",
];
