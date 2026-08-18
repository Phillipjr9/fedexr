const { exec } = require('child_process');

function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout ? stdout.toString() : '', stderr: stderr ? stderr.toString() : '' });
    });
  });
}

async function main() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error('Set VERCEL_TOKEN environment variable before running this script.');
    process.exit(1);
  }

  console.log('Running: vercel whoami');
  let r = await run(`npx vercel whoami --token ${token}`);
  console.log(r.stdout || r.stderr);

  console.log('\nRunning: vercel projects list');
  r = await run(`npx vercel projects list --token ${token} --yes`);
  console.log(r.stdout || r.stderr);

  console.log('\nNote: To inspect a specific project, run:');
  console.log('  npx vercel projects inspect <project-slug> --token $VERCEL_TOKEN');
  console.log('  npx vercel deployments list --project <project-slug> --limit 20 --token $VERCEL_TOKEN');
  console.log('  npx vercel env ls <project-slug> --token $VERCEL_TOKEN');
  console.log('\nPaste the outputs here and I will analyze them.');
}

main();
