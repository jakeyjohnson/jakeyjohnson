/* =========================================================
   Jake's Budget Estimator — Rate Engine
   Pure calculation module. No DOM access. Every constant here
   is a documented [assumption] from
   .design/budget-estimator/DESIGN_BRIEF.md §Calculation Logic
   — London experiential/luxury retail production benchmarks,
   not client-supplied rates. Tune the constants below if real
   rate-card figures become available; the formulas don't need
   to change.
   ========================================================= */

(function () {
  'use strict';

  var LABELS = {
    projectType: {
      'pop-up': 'Pop-up Store',
      'flagship': 'Flagship Storefront Fit-Out',
      'activation': 'Brand Activation & Event Space',
      'window-display': 'Window Display & Installation'
    },
    location: {
      'central-london': 'Central London (Prime)',
      'other-uk': 'Other UK City',
      'international': 'International'
    },
    tier: {
      standard: 'Standard',
      premium: 'Premium',
      luxury: 'Ultra-Luxury (Bespoke)'
    }
  };

  // Sensible starting point per project type — brief: "sensible default per project type"
  var DEFAULTS = {
    'pop-up': { sqm: 40, weeks: 4 },
    'flagship': { sqm: 150, weeks: 10 },
    'activation': { sqm: 60, weeks: 2 },
    'window-display': { sqm: 15, weeks: 3 }
  };

  // Typical size/duration bounds per project type, used only for the
  // non-blocking "that's unusual" inline note — never blocks Calculate.
  var RANGES = {
    'pop-up': { sqm: [15, 120], weeks: [1, 12] },
    'flagship': { sqm: [60, 400], weeks: [4, 26] },
    'activation': { sqm: [20, 200], weeks: [1, 6] },
    'window-display': { sqm: [3, 40], weeks: [1, 8] }
  };

  var RATE_PER_SQM = { standard: 550, premium: 1100, luxury: 2000 }; // £/sqm core build
  var FURNITURE_TIER_MULT = { standard: 1.0, premium: 1.3, luxury: 1.8 };
  var DESIGN_FEE_PCT = { standard: 0.08, premium: 0.12, luxury: 0.15 };

  var LOCATION_MULT = { 'central-london': 1.15, 'other-uk': 1.0, 'international': 1.3 };
  var SITE_DAY_RATE = { 'central-london': 120, 'other-uk': 40, 'international': 80 }; // £/day, landlord/permit line only

  var TYPE_MULT = {
    'pop-up': { fabrication: 1.0, site: 1.0, av: 1.0, designFeeBonus: 0, excludeLandlordFee: false },
    'flagship': { fabrication: 1.1, site: 1.2, av: 1.0, designFeeBonus: 0.03, excludeLandlordFee: false },
    'activation': { fabrication: 0.85, site: 1.0, av: 1.4, designFeeBonus: 0, excludeLandlordFee: false },
    'window-display': { fabrication: 0.6, site: 0.3, av: 1.0, designFeeBonus: 0, excludeLandlordFee: true }
  };

  var CONTINGENCY_PCT = 0.10;
  var RANGE_SPREAD = 0.12; // total shown as total*(1-0.12) to total*(1+0.12)

  function gbp(n) {
    return '£' + Math.round(n).toLocaleString('en-GB');
  }

  function pct(n) {
    // n as a fraction, e.g. 0.15 -> "15%"
    return Math.round(n * 1000) / 10 + '%';
  }

  /**
   * @param {Object} inputs
   * @param {'pop-up'|'flagship'|'activation'|'window-display'} inputs.projectType
   * @param {'central-london'|'other-uk'|'international'} inputs.location
   * @param {number} inputs.sqm
   * @param {number} inputs.weeks
   * @param {'standard'|'premium'|'luxury'} inputs.tier
   * @param {Object} inputs.extras - booleans: bespokeJoinery, structuralGlazing, signage, furniture, av, staffing
   * @returns {{categories: Array, total: number, rangeLow: number, rangeHigh: number, assumptionsUsed: string[]}}
   */
  function calculateEstimate(inputs) {
    var sqm = Math.max(0, Number(inputs.sqm) || 0);
    var weeks = Math.max(0, Number(inputs.weeks) || 0);
    var tier = inputs.tier;
    var location = inputs.location;
    var projectType = inputs.projectType;
    var extras = inputs.extras || {};

    var typeMult = TYPE_MULT[projectType];
    var locMult = LOCATION_MULT[location];
    var assumptions = [];

    // ---- Fabrication & Materials ----
    var coreBuild = sqm * RATE_PER_SQM[tier] * locMult * typeMult.fabrication;
    var fabItems = [{ name: 'Core Build & Fit-Out', amount: coreBuild }];
    assumptions.push(
      RATE_PER_SQM[tier].toLocaleString('en-GB') + ' £/sqm base build rate (' + LABELS.tier[tier] + ' finish)'
    );
    if (locMult !== 1) {
      assumptions.push((locMult > 1 ? '+' : '') + Math.round((locMult - 1) * 100) + '% location adjustment (' + LABELS.location[location] + ')');
    }
    if (typeMult.fabrication !== 1) {
      assumptions.push((typeMult.fabrication > 1 ? '+' : '') + Math.round((typeMult.fabrication - 1) * 100) + '% build-complexity adjustment (' + LABELS.projectType[projectType] + ')');
    }

    if (extras.bespokeJoinery) {
      fabItems.push({ name: 'Bespoke Joinery & Finishes', amount: coreBuild * 0.25 });
      assumptions.push('Bespoke joinery & finishes: +25% of core build cost');
    }
    if (extras.structuralGlazing) {
      fabItems.push({ name: 'Structural & Glazing Work', amount: coreBuild * 0.20 });
      assumptions.push('Structural & glazing work: +20% of core build cost');
    }
    if (extras.signage) {
      var signageAmount = Math.max(3000, sqm * 150);
      fabItems.push({ name: 'Custom Signage & Graphics Production', amount: signageAmount });
      assumptions.push('Signage & graphics: £150/sqm, £3,000 minimum');
    }
    if (extras.furniture) {
      var furnitureAmount = sqm * 120 * FURNITURE_TIER_MULT[tier];
      fabItems.push({ name: 'Furniture, Fixtures & Styling Props', amount: furnitureAmount });
      assumptions.push('Furniture & styling: £120/sqm × ' + FURNITURE_TIER_MULT[tier] + ' (' + LABELS.tier[tier] + ' finish)');
    }
    var fabSubtotal = sum(fabItems);

    // ---- Design & Concept ----
    var designPct = DESIGN_FEE_PCT[tier] + typeMult.designFeeBonus;
    var designFeeTotal = fabSubtotal * designPct;
    var designItems = [
      { name: 'Concept Design & 3D Visualisation', amount: designFeeTotal * 0.7 },
      { name: 'Technical Drawings & Production Spec', amount: designFeeTotal * 0.3 }
    ];
    assumptions.push('Design fee: ' + pct(designPct) + ' of fabrication subtotal (' + LABELS.tier[tier] + ' finish' + (typeMult.designFeeBonus ? ', +' + pct(typeMult.designFeeBonus) + ' flagship complexity' : '') + ')');
    var designSubtotal = sum(designItems);

    // ---- Site & Logistics ----
    var siteItems = [];
    if (!typeMult.excludeLandlordFee) {
      var landlordAmount = weeks * 7 * SITE_DAY_RATE[location];
      siteItems.push({ name: 'Landlord Fees, Permits & Business Rates', amount: landlordAmount });
      assumptions.push('Landlord/permit costs: £' + SITE_DAY_RATE[location] + '/day (' + LABELS.location[location] + ')');
    }
    var logisticsAmount = (1500 + sqm * 35) * typeMult.site;
    siteItems.push({ name: 'Freight, Storage & Site Logistics', amount: logisticsAmount });
    var installAmount = sqm * 45 * typeMult.site;
    siteItems.push({ name: 'Installation & De-Rig Labour', amount: installAmount });
    assumptions.push('Freight/storage: £1,500 base + £35/sqm; install & de-rig: £45/sqm');
    if (typeMult.site !== 1) {
      assumptions.push((typeMult.site > 1 ? '+' : '') + Math.round((typeMult.site - 1) * 100) + '% site-complexity adjustment (' + LABELS.projectType[projectType] + ')');
    }
    var insuranceAmount = Math.max(800, fabSubtotal * 0.02);
    siteItems.push({ name: 'Insurance & Compliance', amount: insuranceAmount });
    assumptions.push('Insurance & compliance: 2% of fabrication subtotal, £800 minimum');
    var siteSubtotal = sum(siteItems);

    // ---- Production & Staffing ----
    var prodItems = [];
    var pmFee = (fabSubtotal + siteSubtotal) * 0.10;
    prodItems.push({ name: 'Project Management', amount: pmFee });
    assumptions.push('Project management: 10% of fabrication + site & logistics subtotal');

    if (extras.av) {
      var avAmount = (sqm * 180 + weeks * 900) * typeMult.av;
      prodItems.push({ name: 'AV, Lighting & Technical Production', amount: avAmount });
      assumptions.push('AV & lighting: £180/sqm + £900/week' + (typeMult.av !== 1 ? ' × ' + typeMult.av + ' (' + LABELS.projectType[projectType] + ')' : ''));
    }
    if (extras.staffing) {
      var staffingAmount = 2 * 220 * (weeks * 6);
      prodItems.push({ name: 'On-Site Staffing', amount: staffingAmount });
      assumptions.push('On-site staffing: 2 crew × £220/day × 6 days/week');
    }

    var runningTotal = fabSubtotal + designSubtotal + siteSubtotal + sum(prodItems);
    var contingency = runningTotal * CONTINGENCY_PCT;
    prodItems.push({ name: 'Contingency (10%)', amount: contingency });
    assumptions.push('Contingency: 10% of all line items above — always included, not optional');
    var prodSubtotal = sum(prodItems);

    var total = runningTotal + contingency;

    var categories = [
      { name: 'Design & Concept', items: designItems, subtotal: designSubtotal },
      { name: 'Fabrication & Materials', items: fabItems, subtotal: fabSubtotal },
      { name: 'Site & Logistics', items: siteItems, subtotal: siteSubtotal },
      { name: 'Production & Staffing', items: prodItems, subtotal: prodSubtotal }
    ];

    return {
      categories: categories,
      total: total,
      rangeLow: total * (1 - RANGE_SPREAD),
      rangeHigh: total * (1 + RANGE_SPREAD),
      assumptionsUsed: assumptions
    };
  }

  function sum(items) {
    var t = 0;
    for (var i = 0; i < items.length; i++) t += items[i].amount;
    return t;
  }

  window.BudgetEstimator = window.BudgetEstimator || {};
  window.BudgetEstimator.calculateEstimate = calculateEstimate;
  window.BudgetEstimator.LABELS = LABELS;
  window.BudgetEstimator.DEFAULTS = DEFAULTS;
  window.BudgetEstimator.RANGES = RANGES;
  window.BudgetEstimator.formatCurrency = gbp;
})();
