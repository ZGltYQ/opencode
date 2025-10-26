import path from "path"
import { $ } from "bun"
import z from "zod/v4"
import { NamedError } from "../util/error"
import { Bus } from "../bus"
import { Log } from "../util/log"

declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
}

export namespace Installation {
  const log = Log.create({ service: "installation" })

  export type Method = Awaited<ReturnType<typeof method>>

  export const Event = {
    Updated: Bus.event(
      "installation.updated",
      z.object({
        version: z.string(),
      }),
    ),
  }

  export const Info = z
    .object({
      version: z.string(),
      latest: z.string(),
    })
    .meta({
      ref: "InstallationInfo",
    })
  export type Info = z.infer<typeof Info>

  export async function info() {
    return {
      version: VERSION,
      latest: await latest(),
    }
  }

  export function isPreview() {
    return CHANNEL !== "latest"
  }

  export function isLocal() {
    return CHANNEL === "local"
  }

  export async function method() {
    if (process.execPath.includes(path.join(".opencode", "bin"))) return "curl"
    if (process.execPath.includes(path.join(".local", "bin"))) return "curl"
    const exec = process.execPath.toLowerCase()

    const checks = [
      {
        name: "npm" as const,
        command: () => $`npm list -g --depth=0`.throws(false).text(),
      },
      {
        name: "yarn" as const,
        command: () => $`yarn global list`.throws(false).text(),
      },
      {
        name: "pnpm" as const,
        command: () => $`pnpm list -g --depth=0`.throws(false).text(),
      },
      {
        name: "bun" as const,
        command: () => $`bun pm ls -g`.throws(false).text(),
      },
      {
        name: "brew" as const,
        command: () => $`brew list --formula opencode-ai`.throws(false).text(),
      },
    ]

    checks.sort((a, b) => {
      const aMatches = exec.includes(a.name)
      const bMatches = exec.includes(b.name)
      if (aMatches && !bMatches) return -1
      if (!aMatches && bMatches) return 1
      return 0
    })

    for (const check of checks) {
      const output = await check.command()
      if (output.includes("opencode-ai")) {
        return check.name
      }
    }

    return "unknown"
  }

  export const UpgradeFailedError = NamedError.create(
    "UpgradeFailedError",
    z.object({
      stderr: z.string(),
    }),
  )

  export async function upgrade(method: Method, target: string) {
    const platform = process.platform === "win32" ? "windows" : process.platform
    const arch = process.arch
    const binaryName = `opencode-${platform}-${arch}`
    const downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${target}/${binaryName}.tar.gz`

    log.info("downloading from GitHub", { url: downloadUrl })

    const tmpDir = `/tmp/opencode-upgrade-${Date.now()}`
    const binaryPath = process.execPath
    const binaryDir = path.dirname(binaryPath)
    const tempBinaryPath = path.join(binaryDir, `.opencode.${Date.now()}.tmp`)

    // Download and extract to temp directory
    await $`mkdir -p ${tmpDir}`.quiet()
    const downloadResult = await $`curl -fsSL ${downloadUrl} | tar -xz -C ${tmpDir}`.quiet().throws(false)

    if (downloadResult.exitCode !== 0) {
      await $`rm -rf ${tmpDir}`.quiet()
      throw new UpgradeFailedError({
        stderr: downloadResult.stderr.toString("utf8"),
      })
    }

    // Copy to temp file in same directory, then atomically rename
    const newBinary = path.join(tmpDir, binaryName, "bin", "opencode")
    const copyResult = await $`cp ${newBinary} ${tempBinaryPath} && chmod +x ${tempBinaryPath}`.quiet().throws(false)

    if (copyResult.exitCode !== 0) {
      await $`rm -rf ${tmpDir}`.quiet()
      await $`rm -f ${tempBinaryPath}`.quiet()
      throw new UpgradeFailedError({
        stderr: copyResult.stderr.toString("utf8"),
      })
    }

    // Atomic rename (works even if binary is running)
    const renameResult = await $`mv ${tempBinaryPath} ${binaryPath}`.quiet().throws(false)

    // Cleanup
    await $`rm -rf ${tmpDir}`.quiet()
    await $`rm -f ${tempBinaryPath}`.quiet()

    log.info("upgraded from GitHub", {
      method: "github",
      target,
      binaryPath,
    })

    if (renameResult.exitCode !== 0)
      throw new UpgradeFailedError({
        stderr: renameResult.stderr.toString("utf8"),
      })
  }

  export const VERSION = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
  export const CHANNEL = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
  export const USER_AGENT = `opencode/${CHANNEL}/${VERSION}`
  export const GITHUB_REPO = process.env.OPENCODE_GITHUB_REPO || "zgltyq/opencode"

  export async function latest() {
    return fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data: any) => data.tag_name.replace(/^v/, ""))
  }
}
