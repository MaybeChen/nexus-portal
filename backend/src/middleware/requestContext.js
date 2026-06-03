const crypto = require('crypto');
const httpContext = require('express-http-context');

function attachRequestContext(config) {
  return (req, res, next) => {
    const requestId = req.get(config.requestIdHeader) || crypto.randomUUID();
    httpContext.set('requestId', requestId);
    res.set(config.requestIdHeader, requestId);
    next();
  };
}

module.exports = {
  attachRequestContext
};
