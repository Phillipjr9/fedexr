import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Generates src/migration-sql.js from migrations/*.sql.
 *
 * The migration runner used to read the .sql files with readFile at runtime.
 * That works from a shell, but a serverless bundle does not carry loose .sql
 * files, so applying migrations from a function failed with ENOENT. Inlining
 * them removes that dependency.
 *
 * The .sql files stay the source of truth: this script is the only thing that
 * writes migration-sql.js, and `npm run build` fails if the generated file has
 * drifted from them.
 *
 *   node scripts/build-migration-sql.js           write the module
 *   node scripts/build-migration-sql.js --check   verify only, non-zero on drift
 */

const here = new URL('.', import.meta.url);
const files = {
  workspace: '001-workspace.sql',
  trackingImages: '002-tracking-images.sql',
  publicShipments: '003-public-shipments.sql',
  publicShipmentOperations: '004-public-shipment-operations.sql',
  publicShipmentAutoProgress: '005-public-shipment-auto-progress.sql',
  destinationStreet: '006-destination-street.sql',
};

const checkOnly = process.argv.includes('--check');

async function readMigration(name) {
  const sql = await readFile(fileURLToPath(new URL(`../migrations/${name}`, here)), 'utf8');
  // The module embeds SQL in template literals, so these would break it.
  for (const [label, pattern] of [
    ['a backtick', /`/],
    ['a ${ sequence', /\$\{/],
    ['a backslash', /\\/],
  ]) {
    if (pattern.test(sql))
      throw new Error(`${name} contains ${label}; it cannot be embedded safely. ` +
        'Rewrite the SQL, or change this generator to emit JSON.stringify output.');
  }
  return sql.replace(/\s+$/, '');
}

const sources = {};
for (const [key, name] of Object.entries(files)) sources[key] = await readMigration(name);

// Order matches what migrations.js applied previously: workspace, then public
// shipments and its follow-ups. The image tables are separate because they
// belong to the image migration, not the account plan.
const account = [
  sources.workspace,
  sources.publicShipments,
  sources.publicShipmentOperations,
  sources.publicShipmentAutoProgress,
  sources.destinationStreet,
].join('\n');

const generated = `// GENERATED FILE — do not edit by hand.
// Source of truth: server/migrations/*.sql
// Regenerate: npm --prefix server run gen:migrations
// \`npm --prefix server run build\` fails if this file has drifted.
//
// Inlined so migrations can run inside a serverless function, whose bundle does
// not include loose .sql files.

export const accountMigrationSQL = \`${account}
\`;

export const imageMigrationSQL = \`${sources.trackingImages}
\`;

export const migrationSourceFiles = ${JSON.stringify(files, null, 2)};
`;

const target = fileURLToPath(new URL('../src/migration-sql.js', here));

if (checkOnly) {
  let current = '';
  try {
    current = await readFile(target, 'utf8');
  } catch {
    current = '';
  }
  if (current !== generated) {
    console.error(
      'src/migration-sql.js is out of date with migrations/*.sql.\n' +
        'Run: npm --prefix server run gen:migrations',
    );
    process.exit(1);
  }
  console.log('migration-sql.js is in sync with migrations/*.sql');
} else {
  await writeFile(target, generated, 'utf8');
  console.log(`wrote src/migration-sql.js (${generated.length} bytes)`);
}
