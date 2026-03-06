'use strict';

const express = require('express');

const {
  decodeVin,
  getModelsForMake,
  getTrimsCarQuery,
  getRecallsByVehicle,
  getComplaintsByVehicle,
  getSafetyRatings,
} = require('../services/tools/cars');

function createToolsCarsRouter() {
  const router = express.Router();

  // NOTE: All endpoints are public, free, and do NOT require an API key.

  // GET /tools/cars/vin?vin=...&modelYear=...
  router.get('/vin', async (req, res) => {
    try {
      const vin = req.query.vin;
      const modelYear = req.query.modelYear;
      const out = await decodeVin({ vin, modelYear });
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /tools/cars/models?make=...&modelYear=...&vehicleType=...
  router.get('/models', async (req, res) => {
    try {
      const make = req.query.make;
      const modelYear = req.query.modelYear;
      const vehicleType = req.query.vehicleType;
      const out = await getModelsForMake({ make, modelYear, vehicleType });
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /tools/cars/trims?make=...&model=...&year=...&keyword=...&full_results=0|1
  router.get('/trims', async (req, res) => {
    try {
      const make = req.query.make;
      const model = req.query.model;
      const year = req.query.year;
      const keyword = req.query.keyword;
      const full_results = req.query.full_results;
      const out = await getTrimsCarQuery({ make, model, year, keyword, full_results });
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /tools/cars/recalls?make=...&model=...&year=...
  router.get('/recalls', async (req, res) => {
    try {
      const make = req.query.make;
      const model = req.query.model;
      const year = req.query.year;
      const out = await getRecallsByVehicle({ make, model, year });
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /tools/cars/complaints?make=...&model=...&year=...
  router.get('/complaints', async (req, res) => {
    try {
      const make = req.query.make;
      const model = req.query.model;
      const year = req.query.year;
      const out = await getComplaintsByVehicle({ make, model, year });
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // GET /tools/cars/safety?make=...&model=...&year=...&includeDetail=true|false
  router.get('/safety', async (req, res) => {
    try {
      const make = req.query.make;
      const model = req.query.model;
      const year = req.query.year;
      const includeDetail = String(req.query.includeDetail || 'true').toLowerCase() !== 'false';
      const out = await getSafetyRatings({ make, model, year, includeDetail });
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  return router;
}

module.exports = { createToolsCarsRouter };
