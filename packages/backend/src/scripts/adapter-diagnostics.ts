import { initDatabase, runMigrations, seedModels } from '../db/index.js';
import { registerAllAdapters } from '../adapters/bootstrap.js';
import { registry } from '../adapters/registry.js';
import type { RawSession } from '../adapters/types.js';

async function main() {
  await initDatabase();
  runMigrations();
  seedModels();
  registerAllAdapters();

  const diagnostics = [];
  for (const adapter of registry.getAll()) {
    const detected = await adapter.detect();
    const paths = detected ? await adapter.discover() : [];
    const samplePaths = paths.slice(0, 3);
    const samples = [];

    for (const path of samplePaths) {
      try {
        const parsed = await adapter.parse(path, null);
        samples.push({
          sourcePath: path,
          sessionsParsed: parsed.length,
          sessions: parsed.slice(0, 2).map(summarizeSession),
        });
      } catch (error) {
        samples.push({
          sourcePath: path,
          error: String(error),
        });
      }
    }

    diagnostics.push({
      cli: adapter.cli,
      detected,
      watchPaths: adapter.watchPaths ? await adapter.watchPaths() : [],
      discoveredSources: paths.length,
      sampleSources: samplePaths,
      capabilities: adapter.getCapabilities?.() ?? null,
      samples,
    });
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), diagnostics }, null, 2));
}

function summarizeSession(session: RawSession) {
  return {
    sessionId: session.sessionId,
    provider: session.provider,
    model: session.model,
    projectPath: session.projectPath,
    sourcePath: session.sourcePath ?? null,
    sourceConfidence: session.sourceConfidence,
    messageCount: session.messages.length,
    messageRoles: [...new Set(session.messages.map((message) => message.role))],
    toolCount: session.toolEvents?.length ?? 0,
    toolNames: [...new Set((session.toolEvents ?? []).map((tool) => tool.toolName))].slice(0, 10),
    fileCount: session.fileEvents?.length ?? 0,
    fileOperations: [...new Set((session.fileEvents ?? []).map((file) => file.operation))],
    usageEvents: session.usageEvents.length,
    hasCost: session.totalCostUsd != null,
    dataQuality: session.dataQuality ?? null,
  };
}

void main().catch((error) => {
  console.error('adapter diagnostics failed');
  console.error(error);
  process.exit(1);
});
