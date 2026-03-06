import { spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import path from 'node:path'

type RunResult = { code: number; output: string }

function run(cmd: string, args: string[], cwd: string, logFile?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === 'win32' })
    let output = ''

    const logStream = logFile ? createWriteStream(logFile, { flags: 'w' }) : null
    const onChunk = (chunk: Buffer) => {
      const s = chunk.toString()
      output += s
      process.stdout.write(s)
      logStream?.write(s)
    }

    child.stdout.on('data', onChunk)
    child.stderr.on('data', onChunk)
    child.on('close', (code) => {
      logStream?.end()
      resolve({ code: code ?? 1, output })
    })
  })
}

async function tryInstallPythonDeps(repoRoot: string) {
  const reqPath = path.join(repoRoot, 'scripts', 'requirements.txt')
  if (!existsSync(reqPath)) return

  // Prefer python3 if available; fall back to python (Windows).
  const pythonCmds = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python']

  for (const py of pythonCmds) {
    const res = await run(py, ['-m', 'pip', 'install', '--user', '-r', reqPath], repoRoot)
    if (res.code === 0) return
  }

  console.warn('⚠️  Warning: Could not install Python dependencies from scripts/requirements.txt. PDF auto-tagging will be unavailable.')
}

async function main() {
  const repoRoot = process.cwd()

  // Optional (best-effort): install Python deps for PDF auto-tagging.
  await tryInstallPythonDeps(repoRoot)

  // Run Next.js build and capture output (for CI troubleshooting).
  const logFile = path.join(repoRoot, 'build.log')
  const build = await run('npm', ['run', 'build:next'], repoRoot, logFile)

  if (build.code === 0) process.exit(0)

  // Preserve prior behavior: tolerate specific _error static generation issues.
  const out = build.output
  const onlyErrorPages =
    out.includes("Html") &&
    out.includes("should not be imported outside of pages/_document") &&
    out.includes("Export encountered errors on following paths") &&
    (out.includes("/_error: /404") || out.includes("/_error: /500"))

  if (onlyErrorPages) {
    console.log('')
    console.log('⚠️  Build completed with warnings about error page generation.')
    console.log("   These pages will be rendered dynamically at runtime.")
    console.log('   The build output is still valid for standalone deployment.')
    console.log('')
    process.exit(0)
  }

  process.exit(build.code)
}

main().catch((err) => {
  console.error('Build script failed:', err)
  process.exit(1)
})

