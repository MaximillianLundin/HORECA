// Privacy notice text for the Support tool (sv + en; other languages fall back to en).
// Draft for legal review — keep in sync with what app.js actually logs and loads.
const PRIVACY_TEXT = {
  sv: {
    title: 'Integritetsmeddelande',
    updated: 'Uppdaterad 4 september 2026',
    sections: [
      { h: 'Vem som ansvarar', p: [
        'Bluewater Group AB (”Bluewater”, ”vi”) är personuppgiftsansvarig för de uppgifter som behandlas i Café Station Support. Frågor om dina uppgifter: support@bluewatergroup.com.',
      ]},
      { h: 'Vad vi samlar in och varför', p: [
        'Guiden kräver inget konto och frågar aldrig efter namn, e-post eller telefonnummer.',
        'För att kunna förbättra guiden loggar vi varje session: vilken produkt det gäller, vilka steg du klickar på och när, hur lång sessionen är, om problemet blev löst samt vilken typ av webbläsare och enhet du använder (så kallad user agent).',
        'Texten du skriver i sökfältet används bara för att hitta rätt felsökningssteg. Skriv inte in namn, telefonnummer eller andra personuppgifter där.',
        'Rättslig grund är vårt berättigade intresse (artikel 6.1 f GDPR) av att se var guiden fungerar och var den behöver bli bättre. Loggen kopplas inte till någon person.',
      ]},
      { h: 'När du mejlar support', p: [
        'Mejlknappen öppnar ditt eget e-postprogram med ett färdigt utkast. Det du väljer att skicka hanteras i Bluewaters supportbrevlåda (Microsoft 365) för att kunna hjälpa dig med ärendet.',
      ]},
      { h: 'Cookies, lagring i webbläsaren och spårning', p: [
        'Vi använder inga cookies, ingen besöksstatistik och inga annonsspårare.',
        'Ditt språkval och en kopia av guidens innehåll sparas lokalt i din webbläsare så att guiden laddar snabbare. Inget av det identifierar dig.',
        'Videor spelas upp via Vimeo och laddas först när du öppnar ett kapitel, med Vimeos ”Do Not Track” aktiverat. Typsnitt hämtas från Google Fonts och skriptbibliotek från jsDelivr, vilket innebär att dessa leverantörer ser din IP-adress när sidan laddas.',
      ]},
      { h: 'Vilka som får tillgång till uppgifterna', p: [
        'Sessionsloggen används av Bluewaters produkt- och supportteam. Följande leverantörer behandlar uppgifter för vår räkning enligt personuppgiftsbiträdesavtal: Supabase (databas för sessionsloggen), Vercel (hosting) och Microsoft 365 (e-post).',
        'Överföringar utanför EU/EES skyddas av EU–US Data Privacy Framework eller EU:s standardavtalsklausuler.',
      ]},
      { h: 'Hur länge vi sparar uppgifterna', p: [
        'Sessionsloggar sparas i högst 12 månader och raderas eller anonymiseras därefter. Supportmejl sparas så länge ärendet pågår och enligt Bluewaters rutiner för supportärenden.',
      ]},
      { h: 'Dina rättigheter', p: [
        'Du har rätt att få tillgång till dina uppgifter, få dem rättade eller raderade, begränsa eller invända mot behandlingen och få ut dem i ett flyttbart format. Kontakta support@bluewatergroup.com.',
        'Du kan också lämna klagomål till Integritetsskyddsmyndigheten (IMY), www.imy.se, eller till tillsynsmyndigheten i ditt land.',
      ]},
    ],
  },
  en: {
    title: 'Privacy notice',
    updated: 'Last updated 4 September 2026',
    sections: [
      { h: 'Who is responsible', p: [
        'Bluewater Group AB (“Bluewater”, “we”) is the data controller for the data processed in Café Station Support. Questions about your data: support@bluewatergroup.com.',
      ]},
      { h: 'What we collect and why', p: [
        'The guide works without an account and never asks for your name, email or phone number.',
        'To improve the guide we log each session: which product it concerns, which steps you tap and when, how long the session lasts, whether the problem was solved, and the type of browser and device you use (the so-called user agent).',
        'The text you type in the search field is used only to find the right troubleshooting step. Please do not enter names, phone numbers or other personal details there.',
        'The legal basis is our legitimate interest (Article 6(1)(f) GDPR) in seeing where the guide works and where it needs to improve. The log is not linked to any person.',
      ]},
      { h: 'When you email support', p: [
        'The email button opens your own mail app with a prepared draft. Whatever you choose to send is handled in Bluewater’s support mailbox (Microsoft 365) so we can help with your case.',
      ]},
      { h: 'Cookies, browser storage and tracking', p: [
        'We use no cookies, no visitor analytics and no advertising trackers.',
        'Your language choice and a copy of the guide content are stored locally in your browser so the guide loads faster. None of it identifies you.',
        'Videos are played through Vimeo and load only when you open a chapter, with Vimeo’s “Do Not Track” enabled. Fonts are loaded from Google Fonts and script libraries from jsDelivr, which means these providers see your IP address when the page loads.',
      ]},
      { h: 'Who has access to the data', p: [
        'The session log is used by Bluewater’s product and support team. The following providers process data on our behalf under data processing agreements: Supabase (database for the session log), Vercel (hosting) and Microsoft 365 (email).',
        'Transfers outside the EU/EEA are covered by the EU–US Data Privacy Framework or the EU Standard Contractual Clauses.',
      ]},
      { h: 'How long we keep it', p: [
        'Session logs are kept for at most 12 months and are then deleted or anonymised. Support emails are kept while the case is open and according to Bluewater’s support case routines.',
      ]},
      { h: 'Your rights', p: [
        'You have the right to access your data, have it corrected or deleted, restrict or object to the processing, and receive it in a portable format. Contact support@bluewatergroup.com.',
        'You can also lodge a complaint with the Swedish Authority for Privacy Protection (IMY), www.imy.se, or the supervisory authority in your own country.',
      ]},
    ],
  },
};
