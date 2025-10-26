#!/usr/bin/env bun
import { $ } from "bun"
import path from "path"
import fs from "fs"

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

// Get version from command line or use default
const version = process.argv[2] || "0.0.1"
console.log(`Preparing release v${version}`)

// Build all targets first (unless --skip-build is passed)
if (!process.argv.includes("--skip-build")) {
  console.log("Building all targets...")
  await import("./build.ts")
} else {
  console.log("Skipping build (using existing dist/)...")
}

// Create release directory
const releaseDir = path.join(dir, "dist", "release")
await $`mkdir -p ${releaseDir}`

// Package each build into a tarball
const distDir = path.join(dir, "dist")
const builds = fs.readdirSync(distDir).filter((name) => name.startsWith("opencode-") && name !== "opencode-release")

for (const build of builds) {
  console.log(`Packaging ${build}...`)
  const tarball = path.join(releaseDir, `${build}.tar.gz`)
  await $`tar -czf ${tarball} -C ${distDir} ${build}`
  console.log(`Created ${tarball}`)
}

console.log(`
Release artifacts created in ${releaseDir}

Next steps:
1. Create a new release on GitHub with tag v${version}
2. Upload all .tar.gz files from ${releaseDir} as release assets

Or use gh CLI:
  gh release create v${version} ${releaseDir}/*.tar.gz --title "v${version}" --notes "Release v${version}"
`)
