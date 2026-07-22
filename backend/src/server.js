const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`MSCC-KFS API listening on port ${env.port}`);
});
