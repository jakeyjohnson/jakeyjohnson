import { Packer, Paragraph, Table } from "docx";
import type { Branding } from "@/domain/branding";
import { formatJobCode, type JobCode } from "@/domain/job-code";
import type { ProcurementItem, PurchaseOrder } from "@/domain/documents";
import {
  formatPence,
  orderByDate,
  orderTotals,
  overdueItems,
} from "@/domain/documents";
import type { Project } from "@/domain/types";
import {
  BAND_FILL,
  body,
  buildDocument,
  factTable,
  gridTable,
  heading,
  shadedCell,
  titleBlock,
} from "./shared";

/**
 * Purchase order.
 *
 * Totals are computed, never typed. VAT is rounded once on the net total
 * rather than per line, which is what a supplier's invoice will show, so the
 * two reconcile.
 */
export async function renderPurchaseOrder(
  order: PurchaseOrder,
  project: Project,
  branding: Branding,
  packVersion: string,
): Promise<Buffer> {
  const totals = orderTotals(order);

  const children: (Paragraph | Table)[] = [
    ...titleBlock("Purchase Order", formatJobCode(order.code), branding, order.supplier),

    factTable([
      ["Supplier", order.supplier],
      ["Supplier contact", order.supplierContact],
      ["Project", `${formatJobCode(project.code)} ${project.name}`],
      ["Deliver to", order.deliverTo],
      ["Required by", order.requiredBy],
      ["Raised by", order.raisedBy],
      ["Date raised", order.raisedOn],
    ]),

    heading("Order", branding),
    gridTable(
      [
        { header: "Description", width: 44 },
        { header: "Qty", width: 10 },
        { header: "Unit", width: 12 },
        { header: "Unit price", width: 17 },
        { header: "Line total", width: 17 },
      ],
      [
        ...order.lines.map((line) => [
          line.description,
          String(line.quantity),
          line.unit,
          formatPence(line.unitPricePence),
          formatPence(Math.round(line.quantity * line.unitPricePence)),
        ]),
        ["", "", "", "Net", formatPence(totals.netPence)],
        ["", "", "", `VAT @ ${order.vatRate}%`, formatPence(totals.vatPence)],
        ["", "", "", "Total", formatPence(totals.grossPence)],
      ],
      { emptyMessage: "No lines on this order." },
    ),

    heading("Terms", branding),
    body(order.paymentTerms),
    body(
      `Quote purchase order number ${formatJobCode(order.code)} on all correspondence, delivery notes and invoices. Invoices received without it may be returned.`,
    ),
    body(
      "Goods and services supplied against this order must meet the specification agreed. Any variation in price, specification or delivery date must be agreed in writing before the work is carried out.",
    ),
  ];

  if (order.notes) {
    children.push(heading("Notes", branding), body(order.notes));
  }

  children.push(
    heading("Authorisation", branding),
    factTable([
      ["Authorised by", ""],
      ["Position", ""],
      ["Signature", ""],
      ["Date", ""],
    ]),
  );

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Purchase Order ${formatJobCode(order.code)}`,
      children,
    }),
  );
}

/**
 * Procurement schedule.
 *
 * The order-by date is computed by counting lead time back over working days
 * from the on-site date, because suppliers quote in working days and a
 * weekend silently eats two of them. Anything already past its order-by date
 * is shaded, so the column people skim is the one that matters.
 */
export async function renderProcurementSchedule(
  items: ProcurementItem[],
  project: Project,
  code: JobCode,
  branding: Branding,
  packVersion: string,
  asOf: Date = new Date(),
): Promise<Buffer> {
  const overdue = new Set(overdueItems(items, asOf).map((item) => item.item));
  const budgetTotal = items.reduce((sum, item) => sum + item.budgetPence, 0);

  const children: (Paragraph | Table)[] = [
    ...titleBlock("Procurement Schedule", formatJobCode(code), branding, project.name),

    factTable([
      ["Project", `${formatJobCode(project.code)} ${project.name}`],
      ["Prepared by", project.productionManager],
      ["Items", String(items.length)],
      ["Budget total", formatPence(budgetTotal)],
    ]),

    heading("Items", branding),
    gridTable(
      [
        { header: "Item", width: 26 },
        { header: "Supplier", width: 16 },
        { header: "Lead time", width: 11 },
        { header: "Order by", width: 13 },
        { header: "On site", width: 13 },
        { header: "Budget", width: 12 },
        { header: "Status", width: 9 },
      ],
      items.map((item) => {
        const by = orderByDate(item);
        return [
          item.item,
          item.supplier || "—",
          `${item.leadTimeDays} days`,
          overdue.has(item.item) ? shadedCell(by, BAND_FILL.HIGH) : by,
          item.requiredOnSite,
          formatPence(item.budgetPence),
          item.status,
        ];
      }),
      { emptyMessage: "Nothing scheduled yet." },
    ),
  ];

  if (overdue.size > 0) {
    children.push(
      heading("Overdue", branding),
      body(
        `${overdue.size} item${overdue.size === 1 ? " is" : "s are"} past the date ${
          overdue.size === 1 ? "it" : "they"
        } needed to be ordered to arrive on time. Either order now and confirm the supplier can still meet the date, or change the on-site date.`,
        { bold: true },
      ),
    );
  }

  children.push(
    heading("Lead times", branding),
    body(
      "Order-by dates count the supplier's lead time back over working days from the on-site date. They assume the lead time quoted is accurate and that the supplier has stock. Confirm both when ordering.",
    ),
  );

  return Packer.toBuffer(
    buildDocument({
      branding,
      packVersion,
      title: `Procurement Schedule ${formatJobCode(code)}`,
      children,
    }),
  );
}
