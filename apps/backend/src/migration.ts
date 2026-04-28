/* eslint-disable no-console */
import { generateMigration, revertLastMigration, runMigrations } from '@vendure/core';
import path from 'path';
import { config } from './vendure-config';

const command = process.argv[2];
const name = process.argv[3];

const migrationsDir = path.join(__dirname, './migrations');

(async () => {
  switch (command) {
    case 'generate':
      if (!name) {
        console.error('Migration name required: pnpm migration:generate <name>');
        process.exit(1);
      }
      await generateMigration(config, { name, outputDir: migrationsDir });
      break;
    case 'run':
      await runMigrations(config);
      break;
    case 'revert':
      await revertLastMigration(config);
      break;
    default:
      console.error('Usage: migration <generate|run|revert> [name]');
      process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
