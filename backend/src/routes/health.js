const express = require('express');
const httpContext = require('express-http-context');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nexus-portal-backend',
    requestId: httpContext.get('requestId'),
    uptime: process.uptime()
  });
});

module.exports = router;
