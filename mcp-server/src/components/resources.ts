/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Component resource registration for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Placeholder HTML for components (will be replaced with built components)
const placeholderKelly = '<div id="root" style="padding: 20px; font-family: system-ui;">Kelly Calculator Loading...</div>';
const placeholderProbability = '<div id="root" style="padding: 20px; font-family: system-ui;">Probability Estimator Loading...</div>';

export function registerComponentResources(server: McpServer) {
  // Kelly Calculator Widget
  server.registerResource(
    'kelly-widget',
    'ui://widget/kelly-calculator.html',
    {},
    async () => {
      // Try to load built component, fallback to placeholder
      try {
        const componentPath = join(__dirname, '../../../chatgpt-widgets/dist/kelly-calculator.html');
        const html = readFileSync(componentPath, 'utf8');
        return {
          contents: [{
            uri: 'ui://widget/kelly-calculator.html',
            mimeType: 'text/html+skybridge',
            text: html.trim(),
            _meta: {
              'openai/widgetPrefersBorder': true,
              'openai/widgetDomain': 'https://chatgpt.com',
              'openai/widgetCSP': {
                connect_domains: [],
                resource_domains: ['https://persistent.oaistatic.com']
              },
              'openai/widgetDescription': 'Displays Kelly Criterion betting recommendations including stake amount, percentage of bankroll, and analyst insights'
            }
          }]
        };
      } catch {
        console.warn('Built Kelly calculator component not found, using placeholder');
        return {
          contents: [{
            uri: 'ui://widget/kelly-calculator.html',
            mimeType: 'text/html+skybridge',
            text: placeholderKelly,
            _meta: {
              'openai/widgetPrefersBorder': true,
              'openai/widgetDomain': 'https://chatgpt.com',
              'openai/widgetCSP': {
                connect_domains: [],
                resource_domains: ['https://persistent.oaistatic.com']
              },
              'openai/widgetDescription': 'Displays Kelly Criterion betting recommendations including stake amount, percentage of bankroll, and analyst insights'
            }
          }]
        };
      }
    }
  );

  // Probability Estimator Widget
  server.registerResource(
    'probability-widget',
    'ui://widget/probability-estimator.html',
    {},
    async () => {
      try {
        const componentPath = join(__dirname, '../../../chatgpt-widgets/dist/probability-estimator.html');
        const html = readFileSync(componentPath, 'utf8');
        return {
          contents: [{
            uri: 'ui://widget/probability-estimator.html',
            mimeType: 'text/html+skybridge',
            text: html.trim(),
            _meta: {
              'openai/widgetPrefersBorder': true,
              'openai/widgetDomain': 'https://chatgpt.com',
              'openai/widgetCSP': {
                connect_domains: [],
                resource_domains: ['https://persistent.oaistatic.com']
              },
              'openai/widgetDescription': 'Displays probability estimates for football and basketball games based on team statistics'
            }
          }]
        };
      } catch {
        console.warn('Built probability estimator component not found, using placeholder');
        return {
          contents: [{
            uri: 'ui://widget/probability-estimator.html',
            mimeType: 'text/html+skybridge',
            text: placeholderProbability,
            _meta: {
              'openai/widgetPrefersBorder': true,
              'openai/widgetDomain': 'https://chatgpt.com',
              'openai/widgetCSP': {
                connect_domains: [],
                resource_domains: ['https://persistent.oaistatic.com']
              },
              'openai/widgetDescription': 'Displays probability estimates for football and basketball games based on team statistics'
            }
          }]
        };
      }
    }
  );
}
