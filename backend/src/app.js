const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const routes = require('./routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler. Keeps error details out of the response in
// production while still logging them server-side.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.publicMessage || 'Something went wrong',
  });
});

module.exports = app;
