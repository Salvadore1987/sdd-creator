import { ClaudeCliProbe } from '../../src/adapters/ClaudeCliProbe';

describe('ClaudeCliProbe', () => {
  it('reports installed=false when binary is missing', async () => {
    // arrange
    const probe = new ClaudeCliProbe({ bin: '/no/such/binary/__sdd_test__', timeoutMs: 1_000 });

    // act
    const result = await probe.probe();

    // assert
    expect(result.installed).toBe(false);
    expect(result.hint).toContain('npm i -g @anthropic-ai/claude-code');
  });

  it('reports installed=true when binary executes successfully', async () => {
    // arrange — use Node itself as a stand-in: `node --version` always succeeds
    const probe = new ClaudeCliProbe({ bin: 'node', timeoutMs: 5_000 });

    // act
    const result = await probe.probe();

    // assert
    expect(result.installed).toBe(true);
    expect(result.authenticated).toBe(true);
    expect(result.version ?? '').toMatch(/v\d+/);
  });
});
