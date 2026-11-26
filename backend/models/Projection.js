// models/Projection.js - READ-ONLY view of the MCP server's `projections`.
//
// The MCP server (mcp-server/src/models/Projection.ts) owns this collection:
// every day it records the model's lean on each lined game (`track`) and
// grades it from the final score (`trackResult`). The backend only reads it
// for the public "Model leans" panel, so the schema is loose on purpose.

const mongoose = require('mongoose');

const projectionSchema = new mongoose.Schema({}, { strict: false, collection: 'projections' });

module.exports = mongoose.models.Projection || mongoose.model('Projection', projectionSchema);
