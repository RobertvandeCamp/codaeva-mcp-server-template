import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to find resources directory (works in both dev and production)
// In dev: src/resources/ (relative to loader.ts location)
// In production: dist/resources/ (bundled code runs from dist/index.js)
function findResourcesDir(): string {
  // When bundled, __dirname is the dist directory
  // When running source (unbundled), __dirname is src/resources

  // Try dist/resources (production - bundled code)
  const distResources = join(__dirname, "resources");
  if (existsSync(distResources)) {
    return distResources;
  }

  // Try ../resources (production - if loader.ts is in dist/resources/)
  const distResourcesAlt = join(__dirname, "..", "resources");
  if (existsSync(distResourcesAlt)) {
    return distResourcesAlt;
  }

  // Try src/resources (development)
  const srcResources = join(__dirname, "..", "..", "src", "resources");
  if (existsSync(srcResources)) {
    return srcResources;
  }

  // Fallback to current directory
  return __dirname;
}

const RESOURCES_DIR = findResourcesDir();

export interface ResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  content: string;
}

/**
 * Load a resource file from the resources directory
 */
export function loadResource(filename: string): string {
  const filePath = join(RESOURCES_DIR, filename);
  try {
    if (!existsSync(filePath)) {
      throw new Error(`Resource file not found: ${filePath}`);
    }
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to load resource ${filename}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get all available documentation resources
 */
export function getDocumentationResources(): ResourceInfo[] {
  return [
    {
      uri: "docs://tools-overview",
      name: "Tools Overview",
      description: "Documentation for all available tools in the MCP server",
      mimeType: "text/markdown",
      content: loadResource("TOOLS_OVERVIEW.md"),
    },
  ];
}

/**
 * Get a specific resource by URI
 */
export function getResourceByUri(uri: string): ResourceInfo | undefined {
  return getDocumentationResources().find((r) => r.uri === uri);
}
