import { describe, expect, it } from "vitest";
import {
  expiryState,
  formatPence,
  orderByDate,
  orderTotals,
  overdueItems,
  totalLoadKg,
  underCapacity,
  type LiftingPlan,
  type ProcurementItem,
  type PurchaseOrder,
} from "../documents";
import { requireJobCode } from "../job-code";

describe("money", () => {
  it("formats pence as pounds", () => {
    expect(formatPence(0)).toBe("£0.00");
    expect(formatPence(1)).toBe("£0.01");
    expect(formatPence(123456)).toBe("£1,234.56");
    expect(formatPence(-500)).toBe("-£5.00");
  });

  const order: PurchaseOrder = {
    code: requireJobCode("PROD2026-001a"),
    supplier: "Acme Rigging",
    supplierContact: "",
    deliverTo: "",
    requiredBy: "",
    lines: [
      { description: "Truss hire", quantity: 4, unit: "week", unitPricePence: 12550 },
      { description: "Motor hire", quantity: 2, unit: "week", unitPricePence: 30000 },
    ],
    vatRate: 20,
    paymentTerms: "",
    raisedBy: "",
    raisedOn: "2026-09-21",
  };

  it("totals lines and applies VAT to the net", () => {
    // 4 * 125.50 = 502.00, 2 * 300.00 = 600.00, net 1102.00
    const totals = orderTotals(order);
    expect(totals.netPence).toBe(110200);
    expect(totals.vatPence).toBe(22040);
    expect(totals.grossPence).toBe(132240);
  });

  it("rounds VAT once on the total, not per line", () => {
    // Three lines that each round up individually would over-collect VAT.
    const awkward: PurchaseOrder = {
      ...order,
      lines: [
        { description: "a", quantity: 1, unit: "ea", unitPricePence: 333 },
        { description: "b", quantity: 1, unit: "ea", unitPricePence: 333 },
        { description: "c", quantity: 1, unit: "ea", unitPricePence: 333 },
      ],
    };
    const totals = orderTotals(awkward);
    expect(totals.netPence).toBe(999);
    // 999 * 0.2 = 199.8 -> 200. Per-line would give 67*3 = 201.
    expect(totals.vatPence).toBe(200);
  });

  it("handles an order with no lines", () => {
    expect(orderTotals({ ...order, lines: [] })).toEqual({
      netPence: 0,
      vatPence: 0,
      grossPence: 0,
    });
  });

  it("handles a zero VAT rate", () => {
    const totals = orderTotals({ ...order, vatRate: 0 });
    expect(totals.vatPence).toBe(0);
    expect(totals.grossPence).toBe(totals.netPence);
  });
});

describe("lead times", () => {
  const item = (leadTimeDays: number, requiredOnSite: string): ProcurementItem => ({
    item: "Truss",
    supplier: "Acme",
    leadTimeDays,
    requiredOnSite,
    budgetPence: 0,
    status: "to-order",
  });

  it("counts back over working days, skipping the weekend", () => {
    // Wednesday 2026-11-04, 5 working days back is Wednesday 2026-10-28.
    expect(orderByDate(item(5, "2026-11-04"))).toBe("2026-10-28");
  });

  it("does not eat a weekend silently", () => {
    // Monday 2026-11-02, 1 working day back is Friday 2026-10-30, not Sunday.
    expect(orderByDate(item(1, "2026-11-02"))).toBe("2026-10-30");
  });

  it("returns the same day for a zero lead time", () => {
    expect(orderByDate(item(0, "2026-11-04"))).toBe("2026-11-04");
  });

  it("reports a dash rather than a wrong date for a missing on-site date", () => {
    expect(orderByDate(item(5, ""))).toBe("—");
  });

  it("flags items whose order-by date has passed", () => {
    const asOf = new Date("2026-11-01");
    const items = [item(5, "2026-11-04"), item(1, "2026-12-01")];
    expect(overdueItems(items, asOf)).toHaveLength(1);
  });

  it("does not chase items already ordered or delivered", () => {
    const asOf = new Date("2026-11-01");
    const ordered: ProcurementItem = { ...item(5, "2026-11-04"), status: "ordered" };
    const delivered: ProcurementItem = { ...item(5, "2026-11-04"), status: "delivered" };
    const cancelled: ProcurementItem = { ...item(5, "2026-11-04"), status: "cancelled" };
    expect(overdueItems([ordered, delivered, cancelled], asOf)).toEqual([]);
  });
});

describe("expiry", () => {
  const asOf = new Date("2026-09-21");

  it("reports an expired date", () => {
    expect(expiryState("2026-09-20", asOf)).toBe("expired");
  });

  it("warns inside the notice window", () => {
    expect(expiryState("2026-10-10", asOf)).toBe("expiring");
  });

  it("is quiet well ahead of expiry", () => {
    expect(expiryState("2027-01-01", asOf)).toBe("ok");
  });

  it("distinguishes a missing date from a valid one", () => {
    expect(expiryState(undefined, asOf)).toBe("unknown");
    expect(expiryState("not a date", asOf)).toBe("unknown");
  });

  it("treats today as expiring, not expired", () => {
    expect(expiryState("2026-09-21", asOf)).toBe("expiring");
  });
});

describe("lifting capacity", () => {
  const plan: LiftingPlan = {
    appointedPerson: "A. Reed",
    liftCategory: "Standard",
    description: "",
    loads: [
      { item: "Truss bay", weightKg: 180, dimensions: "3m", attachmentPoints: "2" },
      { item: "Motor", weightKg: 45, dimensions: "", attachmentPoints: "1" },
    ],
    equipment: [
      { item: "Chain hoist 500kg", swlKg: 500, certificate: "TE-2026-01" },
      { item: "Round sling 200kg", swlKg: 200, certificate: "TE-2026-02" },
    ],
    groundConditions: "",
    exclusionZone: "",
    communications: "",
    weatherLimits: "",
    sequence: [],
    emergencyProcedure: "",
    plannedBy: "",
    plannedOn: "",
  };

  it("totals the load", () => {
    expect(totalLoadKg(plan)).toBe(225);
  });

  it("catches equipment rated below the total load", () => {
    const undersized = underCapacity(plan);
    expect(undersized).toHaveLength(1);
    expect(undersized[0].item).toBe("Round sling 200kg");
  });

  it("passes a plan where everything is rated above the load", () => {
    const safe: LiftingPlan = {
      ...plan,
      equipment: [{ item: "Chain hoist 500kg", swlKg: 500, certificate: "TE-2026-01" }],
    };
    expect(underCapacity(safe)).toEqual([]);
  });

  it("reports zero load for a plan with nothing entered", () => {
    expect(totalLoadKg({ ...plan, loads: [] })).toBe(0);
  });
});
