import { CodexTaskAdapter } from './codexAdapter';
import { startCalcuDemo } from './demoHost';

async function main() {
  const host = await startCalcuDemo({
    adapter: new CodexTaskAdapter({
      ...(process.env.CALCU_AGENT_DEBUG === '1'
        ? {
            onDiagnostic: (event: object) =>
              process.stderr.write(
                `Codex diagnostic: ${JSON.stringify(event)}\n`,
              ),
          }
        : {}),
    }),
  });
  process.stdout.write(`Calcu agent demo: ${host.url}\n`);
  const shutdown = () =>
    void host.shutdown().then(
      () => process.exit(0),
      () => {
        process.stderr.write('Calcu agent demo failed: demo_shutdown_failed\n');
        process.exit(1);
      },
    );
  void host.failure.catch(shutdown);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(() => {
  process.stderr.write('Calcu agent demo failed: demo_start_failed\n');
  process.exitCode = 1;
});
