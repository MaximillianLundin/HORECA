// Coffee Rock® — Mineral Knowledge
// Source: V1-CoffeeRock_Chapter_2026

const COFFEE_ROCK = {
  name: 'Coffee Rock®',
  tagline: 'No scale. All flavor.',
  description: 'A scientifically balanced liquid mineral concentrate for coffee brewing. Magnesium-dominant blend aligned with SCA recommendations.',

  benefits: {
    mgOverCa: {
      title: 'Mg > Ca — Magnesium-dominant',
      description: 'Higher magnesium than calcium improves flavor clarity, fruitiness, and complexity. Aligned with SCA (Specialty Coffee Association) water recommendations.'
    },
    phBalance: {
      title: 'Balanced pH',
      description: 'Buffers the natural acidity of espresso. Increases coffee extraction efficiency.'
    },
    zeroChloride: {
      title: 'Zero Chloride',
      description: 'Contains no chloride, which protects your coffee machine from internal corrosion.'
    },
    zeroLowScaling: {
      title: 'Zero-Low Scaling',
      description: 'The magnesium-dominant blend reduces limescale buildup inside the machine.'
    },
    controlledTDS: {
      title: 'Controlled TDS',
      description: 'Precise liquid dosing keeps TDS stable at every cup. Reduces both scaling and corrosion risk.'
    }
  },

  // Coffee Rock® dose (mL/L) → mineral content in water
  dosingTable: [
    { dose_mL_per_L: 1.5, magnesium_mg_per_L: 9,  calcium_mg_per_L: 1.4 },
    { dose_mL_per_L: 2.0, magnesium_mg_per_L: 12, calcium_mg_per_L: 1.9 },
    { dose_mL_per_L: 2.5, magnesium_mg_per_L: 15, calcium_mg_per_L: 2.4 },
    { dose_mL_per_L: 3.0, magnesium_mg_per_L: 18, calcium_mg_per_L: 2.8 },
    { dose_mL_per_L: 3.5, magnesium_mg_per_L: 21, calcium_mg_per_L: 3.3 },
    { dose_mL_per_L: 4.0, magnesium_mg_per_L: 24, calcium_mg_per_L: 3.8 },
    { dose_mL_per_L: 4.5, magnesium_mg_per_L: 27, calcium_mg_per_L: 4.3 }
  ],

  brewModes: {
    espresso: {
      defaultDose: 1.5,
      description: 'Espresso mode. Set and forget — the app doses 1.5 mL/L automatically.'
    },
    brew: {
      doseRange: { min: 1.5, max: 4.5 },
      description: 'Brew mode for filter, pour over, AeroPress, and cold brew. Swipe in the app to adjust mineral level and match roast profile from light to dark.'
    }
  },

  vsCompetitors: {
    standardFilters: {
      problem: 'Mineral levels drop sharply soon after installation, causing unstable TDS and pH — inconsistent coffee quality over time.'
    },
    bypassing: {
      problem: 'Letting unpurified water back in to boost TDS compromises overall water quality and introduces contaminants.'
    },
    bluewater: {
      advantage: 'Precise in-line addition of liquid minerals. No bypass needed. Consistent TDS and pH from the first cup to the last.'
    }
  },

  refill: {
    size: '5 L per jug',
    yield: 'Up to 667 L of mineralized water per jug at the 1.5 mL/L setting.',
    conversionFactor: 0.7,
    measurementNote: 'Always measure TDS on cold water. Ensure your TDS meter uses 0.7 as the conversion factor.'
  },

  tdsGuidance: {
    howToMeasure: [
      'Flush at least 1 litre of cold water from the Bluewater faucet and discard it.',
      'Draw a fresh 1 litre into a clean container.',
      'Dip the TDS meter and wait a few seconds.',
      'Read the value. Always measure cold water, never hot.'
    ],
    tooHigh: 'If TDS is too high: check the dosing level in the app or on the control box. Also measure TDS before mineralization (directly from the purifier) — if it reads above 10 ppm the filter membrane may need replacement.',
    tooLow: 'If TDS is too low: the dosing pump may need priming, or the silicone tubing between the dosing pump and check valve may have disconnected.',
    notSure: 'If unsure what TDS should be: check the current dosing setting in the Bluewater app and compare with the dosing table above.'
  }
};
