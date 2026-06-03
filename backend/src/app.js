require('express-async-errors');

const path = require('path');
const appRoot = require('app-root-path');
const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const express = require('express');
const httpContext = require('express-http-context');

const config = require('../config/default');
const { attachRequestContext } = require('./middleware/requestContext');
const healthRouter = require('./routes/health');
const indexRouter = require('./routes/index');

const app = express();

app.set('views', path.join(appRoot.path, 'views'));
app.set('view engine', 'jade');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(httpContext.middleware);
app.use(attachRequestContext(config));
app.use(express.static(path.join(appRoot.path, 'public')));

app.use('/', indexRouter);
app.use('/api/health', healthRouter);

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status);

  if (req.path.startsWith('/api/')) {
    res.json({
      error: {
        message: err.message,
        status,
        requestId: httpContext.get('requestId')
      }
    });
    return;
  }

  res.render('error', {
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

module.exports = app;
