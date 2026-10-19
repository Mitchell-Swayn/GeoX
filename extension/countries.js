(() => {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries = new Map();
  // ISO 3166-1 regions only; do not turn broad regions into national flags.
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  for (const code of codes) { countries.set(names.of(code).toLowerCase(), code); countries.set(code.toLowerCase(), code); }
  for (const [name, code] of Object.entries({ 'united states of america': 'US', 'usa': 'US', 'uk': 'GB', 'turkey': 'TR', 'türkiye': 'TR', 'south korea': 'KR', 'north korea': 'KP', 'russia': 'RU', 'vietnam': 'VN', 'czech republic': 'CZ', 'ivory coast': 'CI', 'taiwan': 'TW', 'kosovo': 'XK' })) countries.set(name, code);
  // Broad locations use a globe, never a flag for an inferred country.
  const regions = new Map();
  for (const [emoji, labels] of [
    ['🌍', ['Africa', 'North Africa', 'Northern Africa', 'Sub-Saharan Africa', 'West Africa', 'Western Africa', 'East Africa', 'Eastern Africa', 'Central Africa', 'Middle Africa', 'Southern Africa', 'Europe', 'Western Europe', 'Eastern Europe', 'Northern Europe', 'Southern Europe', 'European Union', 'Middle East', 'Middle East & North Africa']],
    ['🌏', ['Asia', 'South Asia', 'Southeast Asia', 'South East Asia', 'South Eastern Asia', 'Southeastern Asia', 'East Asia', 'Eastern Asia', 'Central Asia', 'Western Asia', 'Northern Asia', 'Oceania', 'Australasia', 'Australia and New Zealand', 'Pacific Islands', 'Melanesia', 'Micronesia', 'Polynesia']],
    ['🌎', ['Americas', 'North America', 'Northern America', 'South America', 'Central America', 'Latin America', 'Latin America and the Caribbean', 'Caribbean']],
    ['🇦🇶', ['Antarctica']]
  ]) for (const label of labels) regions.set(label.toLowerCase().replace(/[-‐‑–—]/g, ' ').replace(/\s+/g, ' '), emoji);
  globalThis.GeoXCountries = Object.freeze({ flag(country) {
    if (typeof country !== 'string') return null;
    const label = country.trim().toLowerCase().replace(/[-‐‑–—]/g, ' ').replace(/\s+/g, ' ');
    const code = countries.get(country.trim().toLowerCase());
    return code ? [...code].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('') : regions.get(label) || null;
  }});
})();
