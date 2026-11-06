// Vercel Serverless Function entry point
const handler = require('../backend/api/contact.js');

module.exports = handler;
module.exports.config = handler.config;
