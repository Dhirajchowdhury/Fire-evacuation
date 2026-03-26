const express = require('express');
const router = express.Router();
const { getZones } = require('../controllers/zoneController');

router.get('/', getZones);

module.exports = router;
