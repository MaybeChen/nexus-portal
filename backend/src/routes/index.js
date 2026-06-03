const express = require('express');
const { getPortalCatalog } = require('../services/portalCatalog');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Nexus Portal',
    description: 'SkillHub, AI tools, and model store management portal.'
  });
});

router.get('/api/portal/catalog', (req, res) => {
  res.json(getPortalCatalog());
});

module.exports = router;
