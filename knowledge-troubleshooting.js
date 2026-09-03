// Café Station 1™ — Troubleshooting Knowledge Base
// Structured diagnostic knowledge for support routing and answer generation

const TROUBLESHOOTING = {

  issues: {

    noWater: {
      title: 'No water coming out',
      symptoms: ['no water', 'no flow', 'inget vatten', 'kein wasser', 'pas d\'eau', 'no sale agua'],
      diagnosticPath: [
        {
          question: 'Is the control box powered on (any lights visible)?',
          yes: 'boosterPump',
          no: 'checkPower',
          unknown: 'checkPower'
        },
        {
          id: 'boosterPump',
          question: 'Can you hear the booster pump running (a humming/buzzing sound when drawing water)?',
          yes: 'checkTank',
          no: 'checkPumpConnection',
          unknown: 'checkPumpConnection'
        },
        {
          id: 'checkTank',
          question: 'Is there water in the pressureless tank (the transparent container under the counter)?',
          yes: 'checkMachineConnection',
          no: 'checkFloatSwitch',
          unknown: 'checkFloatSwitch'
        }
      ],
      solutions: {
        checkPower: {
          title: 'Check power supply',
          steps: [
            'Confirm the power cable is plugged into the control box.',
            'Confirm the other end is plugged into the wall socket.',
            'Try unplugging and re-plugging the cable.',
            'Check that the wall socket is working (try another device).'
          ]
        },
        checkPumpConnection: {
          title: 'Check booster pump connection',
          steps: [
            'Locate the hose running from the pressureless tank to the booster pump.',
            'Confirm the hose is firmly connected at both ends.',
            'Check for any kinks or pinches in the hose.',
            'Ensure there are no loose fittings.'
          ]
        },
        checkFloatSwitch: {
          title: 'Check float switch',
          steps: [
            'Locate the float switch cable connected to the control box.',
            'Unplug the float switch cable from the control box.',
            'Reconnect it to the external port closest to the water outlet.',
            'Confirm the cable sits firmly in place.'
          ],
          note: 'If the tank remains empty after reconnecting, check that the purifier is running and producing water.'
        },
        checkMachineConnection: {
          title: 'Check connection to espresso machine',
          steps: [
            'Locate the hose running from the booster pump to the espresso machine.',
            'Confirm all connections are tight.',
            'Check the hose is not kinked or bent.',
            'Ensure the John Guest fittings are clicked in fully.'
          ]
        },
        controlBoxWrongMode: {
          title: 'Reset control box mode',
          steps: [
            'Open the Bluewater app.',
            'Navigate to Settings → Mode.',
            'Switch from the current mode and back again.',
            'If the issue persists, power cycle the control box: unplug it, wait 10 seconds, plug it back in.'
          ]
        }
      }
    },

    tasteBad: {
      title: 'Water tastes wrong or TDS is off',
      symptoms: ['taste', 'tds', 'smak', 'minerals', 'dosing', 'too high', 'too low', 'för högt', 'för lågt'],
      diagnosticPath: [
        {
          question: 'Have you measured TDS with a meter?',
          yes: 'tdsHighOrLow',
          no: 'howToMeasure',
          unknown: 'howToMeasure'
        },
        {
          id: 'tdsHighOrLow',
          question: 'Is TDS too high or too low?',
          high: 'tdsHigh',
          low: 'tdsLow',
          unknown: 'checkDosing'
        }
      ],
      solutions: {
        howToMeasure: {
          title: 'How to measure TDS correctly',
          steps: [
            'Flush at least 1 litre of cold water from the Bluewater faucet. Discard it.',
            'Draw a fresh 1 litre of cold water into a clean container.',
            'Dip the TDS meter and wait a few seconds for a stable reading.',
            'Read the value. Always measure cold water — never hot.'
          ],
          note: 'Ensure your TDS meter uses 0.7 as the conversion factor. Use the Coffee Rock dosing table to find the expected TDS for your dosing setting.'
        },
        tdsHigh: {
          title: 'TDS too high — steps to fix',
          steps: [
            'Check the dosing level in the Bluewater app or on the control box — it may be set higher than intended.',
            'Measure TDS directly from the purifier (before mineralization). If it reads above 10 ppm, the membrane filter may need replacement — contact Bluewater support.',
            'Reconnect the Bluewater app to the control box via Bluetooth and verify the dosing setting.'
          ]
        },
        tdsLow: {
          title: 'TDS too low — steps to fix',
          steps: [
            'Check the dosing setting in the app — it may be lower than intended.',
            'Prime the dosing pump: open the Bluewater app and run the priming cycle.',
            'Inspect the silicone tubing from the dosing pump to the check valve. Reconnect if loose and secure with a zip tie.'
          ]
        },
        checkDosing: {
          title: 'Check dosing pump and tubing',
          steps: [
            'Open the Bluewater app and confirm the current dosing setting.',
            'Compare with the Coffee Rock dosing table to verify expected mineral levels.',
            'Inspect all tubing connections from the mineral jug through the dosing pump to the check valve.',
            'Run the priming function in the app to ensure the dosing pump is delivering minerals.'
          ]
        },
        tubingDisconnected: {
          title: 'Check silicone tubing',
          steps: [
            'Locate the thin silicone tube running from the dosing pump to the check valve.',
            'Confirm it is firmly connected at both the pump end and the check valve port.',
            'If loose, reconnect and secure with a zip tie to prevent future disconnection.'
          ]
        }
      }
    },

    lights: {
      title: 'Lights blinking or control box error',
      symptoms: ['blink', 'light', 'lamp', 'ljus', 'licht', 'error', 'control box', 'kontrollbox', 'voyant', 'luz'],
      lightMeanings: {
        powerLight: {
          description: 'Power indicator',
          normal: 'Solid on = system powered and running.',
          error: 'Off = no power. Flashing = power issue.'
        },
        dosingLight: {
          description: 'Dosing pump indicator',
          normal: 'Blinks blue/orange when dosing is active.',
          rotating: 'Rotating orange = pump is priming.',
          green: 'Green = dosing complete, minerals delivered.',
          off: 'Off = no dosing activity.'
        },
        floatLight: {
          description: 'Float switch / tank indicator',
          bothFlashingOrange: 'Both buttons flashing orange = float switch error. Tank is not refilling. Reconnect the float switch cable to the external port closest to the water outlet.',
          on: 'Lit = tank level low, system is refilling.'
        }
      },
      solutions: {
        powerLight: {
          title: 'Power light issue',
          steps: [
            'Confirm all cables are securely connected to the control box and wall sockets.',
            'Power cycle: unplug the control box, wait 10 seconds, plug it back in.',
            'Check the wall socket is functional.'
          ]
        },
        dosingLight: {
          title: 'Dosing light issue',
          steps: [
            'Open the Bluewater app and check the current dosing mode.',
            'Confirm the dosing setting is active in the app.',
            'Run the priming cycle if the pump has not been used recently.',
            'Check that the mineral jug is not empty.'
          ]
        },
        floatSwitchError: {
          title: 'Float switch error (both lights flashing orange)',
          steps: [
            'Locate the float switch cable attached to the control box.',
            'Unplug the cable.',
            'Reconnect it specifically to the external port closest to the water outlet on the control box.',
            'Confirm the cable clicks firmly into place.',
            'Wait 30 seconds and observe if the lights return to normal.'
          ]
        },
        generalLights: {
          title: 'General light / mode issue',
          steps: [
            'Open the Bluewater app.',
            'Go to Settings → Mode and verify the correct mode is selected.',
            'Power cycle the control box: unplug, wait 10 seconds, plug back in.',
            'Re-pair the app with the control box via Bluetooth.'
          ]
        }
      }
    },

    leak: {
      title: 'Leak or overflow',
      symptoms: ['leak', 'läck', 'leck', 'fuit', 'fuga', 'overflow', 'overflow', 'svämma', 'water on floor', 'vatten på golvet'],
      locations: {
        tankOverflow: {
          description: 'Water overflowing from the pressureless tank',
          causes: [
            'Float switch not signalling correctly — tank keeps filling.',
            'Control box valve stuck open.',
            'System set to wrong mode causing continuous fill.'
          ],
          solution: {
            title: 'Tank overflow — steps to fix',
            steps: [
              'First: place a towel and turn off the water supply to the Café Station.',
              'Check the float switch: reconnect the cable to the external port closest to the water outlet.',
              'Check the control box valve: inspect for debris or stuck position.',
              'Verify the operating mode in the Bluewater app — an incorrect mode can cause continuous water flow.',
              'Power cycle the control box.'
            ]
          }
        },
        underCounter: {
          description: 'Water under the counter / from tubing',
          causes: [
            'Loose John Guest fitting.',
            'Check valve not seating correctly — water drips back.',
            'Silicone tubing disconnected.'
          ],
          solution: {
            title: 'Under-counter leak — steps to fix',
            steps: [
              'Turn off water supply.',
              'Inspect all John Guest push-fit connections — press each tube in firmly until it clicks.',
              'Inspect the check valve (the small inline valve on the dosing output line) for dripping.',
              'Check the silicone tube from dosing pump to check valve — reconnect if loose and secure with a zip tie.'
            ]
          }
        },
        atMachine: {
          description: 'Leak at the espresso machine connection',
          causes: [
            'Inlet fitting on the machine not tight.',
            'Hose from booster pump kinked or loose at the machine end.'
          ],
          solution: {
            title: 'Machine connection leak — steps to fix',
            steps: [
              'Turn off water supply.',
              'Tighten the connection at the espresso machine inlet.',
              'Confirm the John Guest fitting is clicked in fully.',
              'Check the hose for damage or kinks.'
            ]
          }
        }
      }
    },

    noPower: {
      title: 'System does not start',
      symptoms: ['no power', 'no start', 'no lights', 'inga lampor', 'slår inte på', 'turn on', 'won\'t start', 'startar inte'],
      solutions: {
        checkCable: {
          title: 'Check power cable',
          steps: [
            'Confirm the power cable is fully inserted into the control box.',
            'Confirm the other end is in a working wall socket.',
            'Try unplugging and re-plugging at both ends.',
            'Test the wall socket with another device.'
          ]
        },
        checkBreaker: {
          title: 'Check circuit breaker',
          steps: [
            'Go to the electrical panel and check if the circuit breaker for the counter area has tripped.',
            'Reset the breaker if needed.',
            'The Café Station requires 3 power sockets — confirm the extension block or outlets can supply enough power.',
            'Confirm all 3 components (control box, booster pump, dosing pump) are plugged in.'
          ]
        }
      }
    }
  },

  // Keywords used by routeFromDescription() for auto-routing
  routingKeywords: {
    noWater:   ['inget vatten', 'no water', 'kein wasser', "pas d'eau", 'no sale agua', 'vatten kommer inte', 'no flow', 'inget flöde', 'water.*not.*com', 'inte.*vatten'],
    tasteBad:  ['tds', 'smak', 'taste', 'geschmack', 'goût', 'sabe', 'mineral', 'dosering', 'dosing', 'för högt', 'för lågt', 'too high', 'too low'],
    lights:    ['blink', 'light', 'lamp', 'ljus', 'licht', 'voyant', 'luz', 'error', 'fel.*box', 'control.*box', 'kontrollbox', 'flashes', 'orange'],
    leak:      ['läck', 'leak', 'leck', 'fuit', 'fuga', 'overflow', 'svämma', 'översvämm', 'débord', 'desbord', 'water on floor'],
    noPower:   ['start', 'ström', 'power', 'strom', 'alimentation', 'encien', 'slå på', 'turn on', 'einschalt', 'no lights', 'inga lampor']
  },

  escalation: {
    email: 'hello@bluewatergroup.com',
    phone: '+46 (0)8-564 738 00',
    emailSubjectFormat: 'Location / System / Symptom / Priority (e.g. "Aurora – Café Station – No flow – Urgent")',
    attachments: [
      'Photo of the installation under the counter',
      'Screenshot from the Bluewater Serve app (About page)',
      'Close-up of tubing and indicator lights',
      'Short video showing the issue'
    ]
  }
};
