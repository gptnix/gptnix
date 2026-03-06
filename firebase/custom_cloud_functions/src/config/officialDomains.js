'use strict';

/**
 * officialDomains.js — Whitelist službenih domena za BiH / HR / region
 *
 * Dodavanje novih domena:
 *   1. Pronađi pravu domenu (npr. iz Cloud Run logova)
 *   2. Dodaj u odgovarajući tier ispod
 *   3. Redeploy — nema promjena u logici
 *
 * Tierovi:
 *   EXACT  — točna domena ili subdomena (vlada-hbz.ba, vladars.net…)
 *   PREFIX — počinje s ovim prefiksom (vlada., kanton., opcina.…)
 *   SUFFIX — završava s ovim sufiksom (.gov.ba, .gov.hr…)
 *   REGEX  — za složenije patterne (rijetko potrebno)
 */

module.exports = {

  // ── Tier A: pravi .gov TLD-ovi i međunarodne org ─────────────────────────
  // Ovi se provjeravaju prvima, ne trebaju listing
  govTldPatterns: [
    /\.gov(\.|$)/i,    // .gov, .gov.ba, .gov.hr, .gov.us...
    /\.europa\.eu$/i,
    /\bun\.org$/i,
    /\.int$/i,         // NATO, WHO, ITU...
  ],

  // ── Tier B: eksplicitni EXACT whitelist ──────────────────────────────────
  // Dodaj ovdje domene koje znaš da su službene, a ne matchaju Tier A/C
  exact: [
    // BiH — federalne institucije
    'fbihvlada.gov.ba',
    'vijeceministara.gov.ba',
    'mvteo.gov.ba',
    'mcp.gov.ba',
    'dei.gov.ba',
    'sap.gov.ba',
    'bhas.gov.ba',
    'fipa.gov.ba',
    'rao.gov.ba',
    'predsjednistvobih.ba',
    'skupstinabd.ba',
    'ads.gov.ba',
    'zik.ba',          // Centralna izborna komisija BiH

    // FBiH kantoni — vlade
    'vlada-hbz.ba',
    'vladatk.gov.ba',
    'vladask.gov.ba',
    'vladazdk.gov.ba',
    'vladabpk.gov.ba',
    'vladahbk.gov.ba',
    'vladapk.gov.ba',
    'vladaunsko-sanskog.ba',
    'vladabosanskopodrinskog.ba',
    'vladazepce.ba',
    'vladaks.ba',

    // RS institucije
    'vladars.net',
    'narodnaskupstinars.net',
    'predsjednikrs.net',

    // Gradovi / općine s netipičnim imenima
    'grad-mostar.ba',
    'mostar.ba',
    'sarajevo.ba',
    'banja-luka.rs.ba',
    'tuzla.ba',
    'zenica.ba',
    'travnik.ba',
    'tomislavgrad.ba',    // 👈 lokalno relevantno
    'livno.ba',
    'siroki-brijeg.ba',
    'citluk.ba',
    'posusje.ba',
    'grude.ba',
    'ljubuski.ba',
    'capljina.ba',

    // HR — institucije
    'sabor.hr',
    'vlada.hr',
    'predsjednik.hr',
    'usud.hr',
    'vsrh.hr',           // Vrhovni sud RH
    'dorh.hr',           // Državno odvjetništvo
    'drzavna-uprava.hr',
    'mfin.hr',
    'mvep.hr',
    'mup.hr',
    'hak.hr',            // HAK
  ],

  // ── Tier C: PREFIX patterni (subdomena mora počinjati s ovim) ────────────
  // vlada.nesto.ba → match, ali nekivlada.ba → NE match
  prefixes: [
    'vlada.',
    'opcina.',
    'opstina.',
    'opština.',
    'kanton.',
    'skupstina.',
    'skupština.',
    'parlament.',
    'predsjednistvo.',
    'predsjedništvo.',
    'sud.',
    'mup.',
    'mfin.',
    'mzos.',
    'mvp.',
    'mfa.',
    'mzos.',
    'grad.',
    'zupanija.',
    'županija.',
    'ministarstvo.',
    'ministry.',
    'government.',
  ],

  // ── Tier D: SUFFIX patterni (domena završava s ovim) ─────────────────────
  suffixes: [
    '.gov.ba',
    '.gov.hr',
    '.gov.rs',
    '.gov.me',           // Crna Gora
    '.gov.si',           // Slovenija
    '.hr/vlada',         // URL path fallback (rijetko potrebno)
  ],
};
