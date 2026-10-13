// Café Station 1™ — Product & Technical Knowledge
// Source: V2-DataSheet_CafeStation1_2026, V1-SystemWalkthrough_Chapter_2026

const PRODUCT = {
  name: 'Café Station 1™',
  description: 'Connects liquid minerals directly to your espresso machine and faucet for perfect flavour extraction. Covers basic brewing needs with 1.5 mL/L mineral setting.',

  components: {
    controlBox: {
      name: 'Control Box',
      description: 'Connects all components and ensures water quality control. Mounted under the counter.',
      dimensions: '172 × 22 × 51 mm',
      indicators: {
        powerLight: 'Shows the system is powered on.',
        dosingLight: 'Blinks when the dosing pump is active.',
        floatLight: 'Lights up when the pressureless tank needs refilling or the float switch signals an issue.'
      }
    },
    dosingPump: {
      name: 'Dosing Pump',
      description: 'Precisely enriches every serving with Coffee Rock® minerals. Housed on top of the 5L mineral jug.',
      dimensions: '190 × 400 × 142 mm (jug + pump)',
      maxBackPressure: '≤ 1 bar',
      refillVolume: '5 L per jug'
    },
    boosterPump: {
      name: 'Booster Pump',
      description: 'Adjusts the water pressure to suit the espresso machine. Creates the pressure needed to push water from the pressureless tank to the machine.',
      dimensions: '370 × 132 × 259 mm'
    },
    pressurelessTank: {
      name: '10L Pressureless Tank',
      description: 'Assures steady mineralization and high flow. Transparent reservoir under the counter. Filled automatically via float switch.',
      dimensions: '260 × 222 × 200 mm',
      capacity: '10 L'
    },
    floatSwitch: {
      name: 'Float Switch',
      description: 'Controls when the pressureless tank is refilled with purified water. Connected to the control box via cable.',
      cable: 'Float switch cable connects to the port on the control box. If tank is not refilling, reconnect cable to the external port closest to the water outlet.'
    },
    faucet: {
      name: 'Single Flow Faucet',
      description: 'Included in the station. Used for pour over, cold brew, and AeroPress brewing.'
    },
    bluewaterO: {
      name: 'Bluewater O™',
      description: 'Glowing indicator that shows when mineralization is active. Comes with a stand. Part of the Mineralizer add-on.'
    },
    mineralJug: {
      name: 'Coffee Rock® Mineral Jug',
      description: '5L jug of Coffee Rock® liquid mineral concentrate. Sold separately as a refill consumable.',
      yield: 'Up to 667 L of mineralized water per jug at the 1.5 mL/L setting.'
    },
    purifier: {
      name: 'Bluewater Purifier',
      description: 'Spirit or Pro series. Sold separately. Provides purified water to the pressureless tank.',
      note: 'A Bluewater purifier is recommended for guaranteed full-quality water.'
    }
  },

  configurations: {
    cafeStation1: {
      name: 'Café Station 1™',
      modes: ['Espresso mode'],
      mineralSetting: '1.5 mL/L (fixed)',
      description: 'Set and forget. One dosing pump for espresso machine and faucet.'
    },
    cafeStation1PlusMineralizer: {
      name: 'Café Station 1™ + Mineralizer',
      modes: ['Espresso mode', 'Brew mode'],
      mineralSetting: '1.5–4.5 mL/L (adjustable via Bluewater App)',
      description: 'A second dosing pump adds Brew mode for filter, pour over, AeroPress, and cold brew. Adjustable mineral levels to match different roasts.'
    }
  },

  specs: {
    installationVolume: '600 × 800 × 600 mm',
    europe: { voltage: '230 V ~ 50/60 Hz', plugType: 'Grounded European / F' },
    us: { voltage: '120 V ~ 60 Hz', plugType: 'Grounded American / B' },
    powerSockets: 3,
    inletPressure: '0.2 – 4.5 bar',
    inletFlow: '0.4 – 6 L/min',
    maxInletTemp: '60°C',
    minInletTemp: '8°C'
  },

  compliance: {
    CE: true,
    CB: true,
    ETL: true,
    installation: 'Must be performed by a certified Bluewater partner.'
  },

  app: {
    name: 'Bluewater App',
    ios: 'iOS 11.0 or later',
    android: 'Android 6 or later',
    bluetooth: true,
    modes: {
      espresso: 'Fixed 1.5 mL/L dosing for espresso machines.',
      brew: 'Adjustable 1.5–4.5 mL/L for filter coffee, pour over, AeroPress, and cold brew. Swipe to match roast from light to dark.'
    }
  }
};
