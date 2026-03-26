const express = require('express');
const router = express.Router();
const { handleFireAlert } = require('../controllers/alertController');

router.post('/', handleFireAlert);

module.exports = router;
