/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Type definitions for OpenAI ChatGPT integration
 */

export interface OpenAIToolOutput {
  structuredContent?: any;
  content?: Array<{ type: string; text: string }>;
  _meta?: Record<string, any>;
}

export type DisplayMode = 'inline' | 'fullscreen' | 'pip';

export interface OpenAI {
  toolOutput?: OpenAIToolOutput;
  displayMode?: DisplayMode;
  maxHeight?: number;
  callTool?: (toolName: string, params: any) => Promise<any>;
  setWidgetState?: (state: any) => void;
  widgetState?: any;
  openExternal?: (url: string) => void;
}

declare global {
  interface Window {
    openai?: OpenAI;
  }
}
