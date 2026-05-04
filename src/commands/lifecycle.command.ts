/* eslint-disable no-console */
import * as path from 'path';

import { Command } from 'commander';

import { FileRepository } from '../adapters/FileRepository';
import { RequirementsItemService } from '../application/RequirementsItemService';
import type { ADR, Requirement, RequirementTopic, Risk } from '../domain/models';
import type { IFileRepository } from '../ports/IFileRepository';

import { runBrainstorm } from './brainstorm.command';
import { addIntegration } from './integrations.command';

const TOPICS: readonly RequirementTopic[] = [
  'stakeholders',
  'context',
  'constraints',
  'glossary',
  'features',
  'domain',
  'quality',
  'dependencies',
  'anti',
  'compliance',
];

export interface LifecycleCommonOptions {
  readonly cwd?: string;
  readonly description?: string;
  readonly inputPath?: string;
}

export interface LifecycleDeps {
  readonly files?: IFileRepository;
}

export async function runAddTopic(
  topic: RequirementTopic,
  options: LifecycleCommonOptions = {},
): Promise<void> {
  const opts = {
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.inputPath !== undefined ? { inputPath: options.inputPath } : {}),
  };
  await runBrainstorm(topic, opts);
}

export async function runEditTopic(
  topic: RequirementTopic,
  options: LifecycleCommonOptions = {},
): Promise<void> {
  await runAddTopic(topic, options);
}

export async function runRemoveTopic(
  topic: RequirementTopic,
  options: LifecycleCommonOptions = {},
): Promise<void> {
  const opts = {
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    skip: true,
  };
  await runBrainstorm(topic, opts);
}

export async function runAddFeature(
  input: Parameters<RequirementsItemService['addFeature']>[0],
  options: { cwd?: string } = {},
  deps: LifecycleDeps = {},
): Promise<Requirement> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const service = new RequirementsItemService({ files }, { cwd });
  const created = await service.addFeature(input);
  console.log(`✔ Added feature ${created.id} — ${created.title}`);
  return created;
}

export async function runAddAdr(
  input: Parameters<RequirementsItemService['addAdr']>[0],
  options: { cwd?: string } = {},
  deps: LifecycleDeps = {},
): Promise<ADR> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const service = new RequirementsItemService({ files }, { cwd });
  const created = await service.addAdr(input);
  console.log(`✔ Added ADR ${created.id} — ${created.title}`);
  return created;
}

export async function runAddRisk(
  input: Parameters<RequirementsItemService['addRisk']>[0],
  options: { cwd?: string } = {},
  deps: LifecycleDeps = {},
): Promise<Risk> {
  const cwd = options.cwd ?? process.cwd();
  const files = deps.files ?? new FileRepository();
  const service = new RequirementsItemService({ files }, { cwd });
  const created = await service.addRisk(input);
  console.log(`✔ Added risk ${created.id} — ${created.title}`);
  return created;
}

async function readJsonInput<T>(filePath: string, options: { cwd?: string }): Promise<T> {
  const cwd = options.cwd ?? process.cwd();
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  const files = new FileRepository();
  return files.readJson<T>(absolute);
}

export function buildAddCommand(): Command {
  const cmd = new Command('add');
  cmd.description('Add or re-run a single SDD section / item');

  for (const topic of TOPICS) {
    cmd
      .command(topic)
      .description(`Re-run brainstorm for "${topic}"`)
      .option('-d, --description <text>', 'Inline user description')
      .option('-i, --input <file>', 'Read user description from a file')
      .action(async (opts: { description?: string; input?: string }) => {
        await runAddTopic(topic, {
          ...(opts.description !== undefined ? { description: opts.description } : {}),
          ...(opts.input !== undefined ? { inputPath: opts.input } : {}),
        });
      });
  }

  cmd
    .command('feature')
    .description('Add a single feature (FR-NNN)')
    .requiredOption('-i, --input <file>', 'JSON file with feature payload')
    .action(async (opts: { input: string }) => {
      const payload = await readJsonInput<Parameters<RequirementsItemService['addFeature']>[0]>(opts.input, {});
      await runAddFeature(payload);
    });

  cmd
    .command('adr')
    .description('Add a single ADR (ADR-NNN)')
    .requiredOption('-i, --input <file>', 'JSON file with ADR payload')
    .action(async (opts: { input: string }) => {
      const payload = await readJsonInput<Parameters<RequirementsItemService['addAdr']>[0]>(opts.input, {});
      await runAddAdr(payload);
    });

  cmd
    .command('risk')
    .description('Add a single risk (RISK-NNN)')
    .requiredOption('-i, --input <file>', 'JSON file with risk payload')
    .action(async (opts: { input: string }) => {
      const payload = await readJsonInput<Parameters<RequirementsItemService['addRisk']>[0]>(opts.input, {});
      await runAddRisk(payload);
    });

  cmd
    .command('integration')
    .description('Add a single integration (INT-NNN) — alias of `sdd integrations add`')
    .requiredOption('-i, --input <file>', 'JSON file with integration payload')
    .option('--category <cat>', 'Sanity-check the payload category')
    .action(async (opts: { input: string; category?: string }) => {
      await addIntegration({
        inputPath: opts.input,
        ...(opts.category !== undefined ? { category: opts.category as never } : {}),
      });
    });

  return cmd;
}

export function buildEditCommand(): Command {
  const cmd = new Command('edit');
  cmd.description('Re-run brainstorm for an existing topic, overwriting the previous answer');
  for (const topic of TOPICS) {
    cmd
      .command(topic)
      .description(`Edit "${topic}"`)
      .option('-d, --description <text>', 'Inline user description')
      .option('-i, --input <file>', 'Read user description from a file')
      .action(async (opts: { description?: string; input?: string }) => {
        await runEditTopic(topic, {
          ...(opts.description !== undefined ? { description: opts.description } : {}),
          ...(opts.input !== undefined ? { inputPath: opts.input } : {}),
        });
      });
  }
  return cmd;
}

export function buildRemoveCommand(): Command {
  const cmd = new Command('remove');
  cmd.description('Mark a topic as skipped (drops it from the spec by default)');
  for (const topic of TOPICS) {
    cmd
      .command(topic)
      .description(`Mark "${topic}" as skipped`)
      .action(async () => {
        await runRemoveTopic(topic);
      });
  }
  return cmd;
}
