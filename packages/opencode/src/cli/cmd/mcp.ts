import { cmd } from "./cmd"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Instance } from "../../project/instance"
import { Config } from "../../config/config"
import { MCP } from "../../mcp"

export const McpCommand = cmd({
  command: "mcp",
  builder: (yargs) => yargs.command(McpListCommand).command(McpAddCommand).demandCommand(),
  async handler() {},
})

export const McpListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list all configured MCP servers",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("MCP Servers")

        const config = await Config.get()
        const serverStatus = await MCP.status()

        if (!config.mcp || Object.keys(config.mcp).length === 0) {
          prompts.log.info("No MCP servers configured")
          prompts.outro("Use 'opencode mcp add' to add a server")
          return
        }

        for (const [name, server] of Object.entries(config.mcp)) {
          const status = serverStatus[name]
          const statusIcon =
            status === "connected"
              ? UI.Style.TEXT_SUCCESS + "●" + UI.Style.TEXT_NORMAL
              : status === "disabled"
                ? UI.Style.TEXT_DIM + "○" + UI.Style.TEXT_NORMAL
                : UI.Style.TEXT_DANGER + "●" + UI.Style.TEXT_NORMAL

          const statusText =
            status === "connected"
              ? UI.Style.TEXT_SUCCESS + "connected" + UI.Style.TEXT_NORMAL
              : status === "disabled"
                ? UI.Style.TEXT_DIM + "disabled" + UI.Style.TEXT_NORMAL
                : UI.Style.TEXT_DANGER + "failed" + UI.Style.TEXT_NORMAL

          UI.println(`  ${statusIcon} ${UI.Style.TEXT_NORMAL_BOLD}${name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${server.type})${UI.Style.TEXT_NORMAL} - ${statusText}`)

          if (server.type === "local") {
            UI.println(`    ${UI.Style.TEXT_DIM}Command: ${server.command.join(" ")}${UI.Style.TEXT_NORMAL}`)
          } else if (server.type === "remote") {
            UI.println(`    ${UI.Style.TEXT_DIM}URL: ${server.url}${UI.Style.TEXT_NORMAL}`)
          }

          if (server.enabled === false) {
            UI.println(`    ${UI.Style.TEXT_DIM}Status: Explicitly disabled${UI.Style.TEXT_NORMAL}`)
          }
        }

        UI.empty()
        const totalCount = Object.keys(config.mcp).length
        const connectedCount = Object.values(serverStatus).filter((s) => s === "connected").length
        prompts.outro(`${connectedCount}/${totalCount} servers connected`)
      },
    })
  },
})

export const McpAddCommand = cmd({
  command: "add",
  describe: "add an MCP server",
  async handler() {
    UI.empty()
    prompts.intro("Add MCP server")

    const name = await prompts.text({
      message: "Enter MCP server name",
      validate: (x) => (x && x.length > 0 ? undefined : "Required"),
    })
    if (prompts.isCancel(name)) throw new UI.CancelledError()

    const type = await prompts.select({
      message: "Select MCP server type",
      options: [
        {
          label: "Local",
          value: "local",
          hint: "Run a local command",
        },
        {
          label: "Remote",
          value: "remote",
          hint: "Connect to a remote URL",
        },
      ],
    })
    if (prompts.isCancel(type)) throw new UI.CancelledError()

    if (type === "local") {
      const command = await prompts.text({
        message: "Enter command to run",
        placeholder: "e.g., opencode x @modelcontextprotocol/server-filesystem",
        validate: (x) => (x && x.length > 0 ? undefined : "Required"),
      })
      if (prompts.isCancel(command)) throw new UI.CancelledError()

      prompts.log.info(`Local MCP server "${name}" configured with command: ${command}`)
      prompts.outro("MCP server added successfully")
      return
    }

    if (type === "remote") {
      const url = await prompts.text({
        message: "Enter MCP server URL",
        placeholder: "e.g., https://example.com/mcp",
        validate: (x) => {
          if (!x) return "Required"
          if (x.length === 0) return "Required"
          const isValid = URL.canParse(x)
          return isValid ? undefined : "Invalid URL"
        },
      })
      if (prompts.isCancel(url)) throw new UI.CancelledError()

      const client = new Client({
        name: "opencode",
        version: "1.0.0",
      })
      const transport = new StreamableHTTPClientTransport(new URL(url))
      await client.connect(transport)
      prompts.log.info(`Remote MCP server "${name}" configured with URL: ${url}`)
    }

    prompts.outro("MCP server added successfully")
  },
})
