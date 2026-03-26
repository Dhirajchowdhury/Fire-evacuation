const express = require('express');
const router = express.Router();
const { getEvacuationRoute } = require('../controllers/routeController');

router.get('/', getEvacuationRoute);

module.exports = router;
