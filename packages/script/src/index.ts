import { $ } from "bun"

if (!process.versions.bun?.startsWith("1.3.")) {
  throw new Error("This script requires bun@1.3.x")
}

const CHANNEL = process.env["OPENCODE_CHANNEL"] ?? (await $`git branch --show-current`.text().then((x) => x.trim()))
const VERSION = await (async () => {
  // Allow direct version override
  if (process.env["OPENCODE_VERSION"]) return process.env["OPENCODE_VERSION"]

  const IS_PREVIEW = CHANNEL !== "latest"
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await fetch("https://registry.npmjs.org/opencode-ai/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = process.env["OPENCODE_BUMP"]?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return CHANNEL !== "latest" && !process.env["OPENCODE_VERSION"]
  },
}
console.log(`opencode script`, JSON.stringify(Script, null, 2))
