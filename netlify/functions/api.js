const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');
const { app } = require('../../server');

const slsHandler = serverless(app, {
  binary: ['application/pdf'],
});

exports.handler = async (event, context) => {
  if (event?.blobs) {
    connectLambda(event);
  }
  return slsHandler(event, context);
};
