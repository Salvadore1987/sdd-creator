import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FileRepository } from '../../src/adapters/FileRepository';
import { HandlebarsTemplateEngine } from '../../src/adapters/HandlebarsTemplateEngine';
import {
  InitAlreadyExistsError,
  InitService,
  type InitInput,
} from '../../src/application/InitService';
import { ConfigManager } from '../../src/domain/ConfigManager';
import { SCHEMA_VERSION } from '../../src/domain/models';
import type { IClaudeCliProbe } from '../../src/ports/IClaudeCliProbe';
import type { ILogger } from '../../src/ports/ILogger';

class NoopLogger implements ILogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public child(): ILogger {
    return this;
  }
}

class FakeProbe implements IClaudeCliProbe {
  public constructor(private readonly result: { installed: boolean; authenticated: boolean }) {}
  public async probe(): Promise<{ installed: boolean; authenticated: boolean; version?: string }> {
    return Promise.resolve({ ...this.result, version: this.result.installed ? '1.2.3' : '' });
  }
}

function baseInput(overrides: Partial<InitInput> = {}): InitInput {
  return {
    metadata: { name: 'demo', description: 'A demo project', owner: 'eldar' },
    stack: 'java',
    architecture: 'hexagonal',
    language: 'en',
    technologies: ['Spring Boot 3', 'PostgreSQL 16'],
    claudeProvider: 'cli',
    ...overrides,
  };
}

describe('InitService (integration)', () => {
  let tempDir: string;
  let templatesRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-init-'));
    templatesRoot = path.resolve(__dirname, '..', '..', 'src', 'templates');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function makeService(overrides: { probeInstalled?: boolean; probeAuth?: boolean } = {}): InitService {
    const files = new FileRepository();
    const configManager = new ConfigManager(files, { cwd: tempDir });
    const templateEngine = new HandlebarsTemplateEngine();
    const probe = new FakeProbe({
      installed: overrides.probeInstalled ?? true,
      authenticated: overrides.probeAuth ?? true,
    });
    return new InitService(
      { files, configManager, templateEngine, logger: new NoopLogger(), cliProbe: probe },
      { cwd: tempDir, templatesRoot },
    );
  }

  it('creates .sdd/{config,requirements,integrations}.json with provider=cli', async () => {
    // arrange
    const service = makeService();

    // act
    const result = await service.execute(baseInput());

    // assert
    const config = JSON.parse(await fs.readFile(result.configPath, 'utf8'));
    const requirements = JSON.parse(await fs.readFile(result.requirementsPath, 'utf8'));
    const integrations = JSON.parse(await fs.readFile(result.integrationsPath, 'utf8'));
    expect(config.schemaVersion).toBe(SCHEMA_VERSION);
    expect(config.claude.provider).toBe('cli');
    expect(config.metadata.name).toBe('demo');
    expect(requirements.schemaVersion).toBe(SCHEMA_VERSION);
    expect(requirements.features.state.status).toBe('pending');
    expect(integrations).toEqual({ schemaVersion: SCHEMA_VERSION, integrations: [] });
  });

  it('renders stack and architecture templates with project context', async () => {
    // arrange
    const service = makeService();

    // act
    const result = await service.execute(baseInput());

    // assert
    const stack = await fs.readFile(result.stackTemplatePath, 'utf8');
    const arch = await fs.readFile(result.architectureTemplatePath, 'utf8');
    expect(stack).toContain('demo');
    expect(stack).toContain('Java');
    expect(arch).toContain('hexagonal');
  });

  it('runs the CLI probe when provider=cli and surfaces the result', async () => {
    // arrange
    const service = makeService({ probeInstalled: false });

    // act
    const result = await service.execute(baseInput({ claudeProvider: 'cli' }));

    // assert
    expect(result.cliProbe).toBeDefined();
    expect(result.cliProbe?.installed).toBe(false);
  });

  it('does not probe CLI when provider=api', async () => {
    // arrange
    const service = makeService();

    // act
    const result = await service.execute(baseInput({ claudeProvider: 'api', claudeModel: 'claude-opus-4-7' }));

    // assert
    expect(result.cliProbe).toBeUndefined();
    const config = JSON.parse(await fs.readFile(result.configPath, 'utf8'));
    expect(config.claude.provider).toBe('api');
    expect(config.claude.model).toBe('claude-opus-4-7');
  });

  it('aborts (default) when .sdd already exists', async () => {
    // arrange
    const service = makeService();
    await service.execute(baseInput());

    // act
    const promise = service.execute(baseInput());

    // assert
    await expect(promise).rejects.toBeInstanceOf(InitAlreadyExistsError);
  });

  it('overwrites existing .sdd when force=true', async () => {
    // arrange
    const service = makeService();
    await service.execute(baseInput());
    const stamp = path.join(tempDir, '.sdd', 'old-marker.txt');
    await fs.writeFile(stamp, 'old');

    // act
    await service.execute(baseInput({ metadata: { name: 'renamed' } }), 'overwrite');

    // assert
    await expect(fs.access(stamp)).rejects.toBeDefined();
    const config = JSON.parse(await fs.readFile(path.join(tempDir, '.sdd', 'config.json'), 'utf8'));
    expect(config.metadata.name).toBe('renamed');
  });

  it('preserves existing files in merge mode', async () => {
    // arrange
    const service = makeService();
    await service.execute(baseInput());
    const requirementsPath = path.join(tempDir, '.sdd', 'requirements.json');
    const original = await fs.readFile(requirementsPath, 'utf8');
    const customised = original.replace('"pending"', '"completed"');
    await fs.writeFile(requirementsPath, customised);

    // act
    await service.execute(baseInput({ metadata: { name: 'renamed' } }), 'merge');

    // assert
    const after = await fs.readFile(requirementsPath, 'utf8');
    expect(after).toBe(customised);
    const config = JSON.parse(await fs.readFile(path.join(tempDir, '.sdd', 'config.json'), 'utf8'));
    expect(config.metadata.name).toBe('demo');
  });
});
