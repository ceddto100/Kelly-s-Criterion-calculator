/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TypeScript declarations for ChatGPT window.openai integration
 */

/**
 * Display modes supported by ChatGPT
 */
export type DisplayMode = 'inline' | 'fullscreen' | 'pip';

/**
 * Widget state that persists across tool calls and re-renders
 */
export interface WidgetState {
  [key: string]: any;
}

/**
 * Structure of tool output from MCP server
 */
export interface ToolOutput {
  // structuredContent fields are at top level
  [key: string]: any;

  // _meta contains additional data not shown in structured content
  _meta?: {
    allTasks?: any[];
    config?: any;
    uiStrings?: Record<string, string>;
    lookupMaps?: Record<string, any>;
    [key: string]: any;
  };
}

/**
 * ChatGPT OpenAI API exposed via window.openai
 */
export interface OpenAIAPI {
  /**
   * Data passed from MCP server tool response
   * structuredContent fields are at top level
   * _meta fields are under _meta property
   */
  toolOutput?: ToolOutput;

  /**
   * Persistent state across component renders
   * Use setWidgetState() to update
   */
  widgetState?: WidgetState;

  /**
   * Current display mode of the widget
   * - inline: Embedded in chat conversation
   * - fullscreen: Full screen overlay
   * - pip: Picture-in-picture floating window
   */
  displayMode?: DisplayMode;

  /**
   * Maximum height constraint in pixels
   * Widget should not exceed this height
   */
  maxHeight?: number;

  /**
   * Update persistent widget state
   * @param newState - New state to merge with existing state
   */
  setWidgetState?: (newState: WidgetState) => void;

  /**
   * Call another tool from the widget
   * @param toolName - Name of the tool to call
   * @param params - Parameters to pass to the tool
   */
  callTool?: (toolName: string, params: any) => Promise<any>;
}

/**
 * Extend Window interface with openai property
 */
declare global {
  interface Window {
    openai?: OpenAIAPI;
  }
}

export {};
