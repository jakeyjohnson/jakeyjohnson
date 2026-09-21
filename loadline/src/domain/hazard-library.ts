import type { Activity } from "./types";

/**
 * Seed hazard library.
 *
 * Transcribed from "PP Risk Assessment PROD2026-002a.docx" (General Risk
 * Assessment Pack 2025 v1.1). Hazard wording and scores are the originals;
 * the controls, which the source pack runs together in a single cell, are
 * split into one entry each so they can be reused across activities and
 * audited individually.
 *
 * This is the reusable template library. A project's assessment starts as a
 * copy of the relevant activities, which the production manager then edits for
 * the specific venue and build — it is a starting point, never a substitute
 * for assessing the actual job.
 */
export const HAZARD_LIBRARY: Activity[] = [
  {
    id: "loading-unloading",
    name: "Loading & Unloading of Equipment",
    description:
      "Scenery, Props and other equipment is packed or unpacked from vehicles",
    hazards: [
      {
        id: "load-shift-in-transit",
        description:
          "Load has moved during transit and is unstable, leading to crush injuries or fractures, abrasions. Heavy loads may cause serious injuries or even fatalities",
        personsAtRisk: ["Production Crew", "Contractors"],
        before: { likelihood: 3, severity: 5 },
        after: { likelihood: 2, severity: 5 },
        controls: [
          {
            id: "load-secured-by-competent-person",
            text: "Ensure that a competent person has secured load at the previous venue.",
          },
          {
            id: "caution-releasing-ties",
            text: "Ensure that pack is tied off, extreme caution to be taken when releasing ties or load bars in case the load has shifted. Additional support may be required to support the load as ties released.",
          },
          {
            id: "foot-protection",
            text: "Suitable Foot Protection such as steel toe capped and steel mid soled footwear to be worn wherever there is a risk of loads falling onto or crushing worker's feet.",
            basis: "PPE at Work Regulations 1992",
          },
        ],
      },
      {
        id: "manual-handling-injury",
        description:
          "Musculoskeletal injuries caused by incorrect lifting techniques or insufficient staff levels to safely move objects",
        personsAtRisk: ["Production Crew", "Contractors"],
        before: { likelihood: 4, severity: 3 },
        after: { likelihood: 2, severity: 3 },
        controls: [
          {
            id: "sufficient-trained-staff",
            text: "Ensure enough competent, trained staff are available to safely lift or move equipment.",
            basis: "Manual Handling Operations Regulations 1992",
          },
          {
            id: "lifting-technique-awareness",
            text: "Ensure all staff are aware of correct lifting techniques and posture.",
          },
          {
            id: "mark-load-weights",
            text: "Wherever possible, the weight of the load and any awkward or unbalanced loads to be clearly indicated on the piece.",
          },
          {
            id: "coordinated-team-lift",
            text: "Good communication essential for team lifting. One person co-ordinating lift. Clear instruction of sequence and activity required for entire handling operation. Team to comprise of suitably matched personnel.",
          },
        ],
      },
      {
        id: "slips-trips-loading-route",
        description:
          "Slips, Trips or Falls caused by obstructions to get in route, leading to fractures, abrasions or bruising.",
        personsAtRisk: ["Production Crew", "Contractors"],
        before: { likelihood: 3, severity: 4 },
        after: { likelihood: 1, severity: 4 },
        controls: [
          {
            id: "clear-loading-route",
            text: "Ensure no obstructions in the path of loading route from the venue. Visual checks on the route before commencing activity.",
          },
          {
            id: "cable-management",
            text: "Cable runs to work lights etc to be routed away from loading route.",
          },
          {
            id: "grip-and-spillages",
            text: "Ensure route has sufficient gripping surface to avoid slips, take extreme caution during wet weather. Any spillages or contamination to be cleared away before allowing any loading activities to continue.",
          },
        ],
      },
      {
        id: "poor-lighting-loading",
        description:
          "Poor lighting conditions leading to increased risk of injury through slips, trips and falls or striking fixed object.",
        personsAtRisk: ["Production Crew", "Contractors"],
        before: { likelihood: 4, severity: 4 },
        after: { likelihood: 1, severity: 4 },
        controls: [
          {
            id: "adequate-lighting",
            text: "If required, ensure adequate light is provided for loading activities, without causing distracting glare or impaired visibility.",
          },
          {
            id: "highlight-level-changes",
            text: "Illuminate/highlight or prevent access to uneven areas, changes in level, steps and fixed obstacles, especially unguarded edges to prevent accidents.",
          },
          {
            id: "vehicle-edge-awareness",
            text: "All production staff are reminded to take caution when moving around loading area and be aware of any potential drop from vehicle level.",
          },
        ],
      },
    ],
  },
];

export function activityById(id: string): Activity | undefined {
  return HAZARD_LIBRARY.find((a) => a.id === id);
}
