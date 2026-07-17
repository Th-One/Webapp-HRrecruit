const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');
const { app } = require('../../server');

const slsHandler = serverless(app);

exports.handler = async (event, context) => {
  if (event?.blobs) {
    connectLambda(event);
  }
  return slsHandler(event, context);
};
