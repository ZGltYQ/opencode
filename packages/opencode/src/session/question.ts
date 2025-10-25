import z from "zod/v4"
import { Bus } from "../bus"
import { Storage } from "../storage/storage"

export namespace Question {
  export const Option = z.object({
    label: z.string().describe("The display text for this option"),
    description: z.string().describe("Explanation of what this option means"),
  })
  export type Option = z.infer<typeof Option>

  export const QuestionItem = z.object({
    question: z.string().describe("The complete question to ask the user"),
    header: z.string().describe("Very short label (max 12 chars)"),
    options: z.array(Option).min(2).max(4).describe("Available choices"),
    multiSelect: z.boolean().describe("Allow multiple selections"),
  })
  export type QuestionItem = z.infer<typeof QuestionItem>

  export const Info = z
    .object({
      id: z.string().describe("Unique identifier for the question set"),
      sessionID: z.string().describe("Session context"),
      messageID: z.string().describe("Message context"),
      callID: z.string().optional().describe("Tool call ID"),
      questions: z.array(QuestionItem).min(1).max(4).describe("Questions to ask"),
      status: z.enum(["pending", "answered", "cancelled"]).describe("Question status"),
      answers: z.record(z.string(), z.string()).optional().describe("User answers"),
      time: z.object({
        created: z.number(),
        answered: z.number().optional(),
      }),
    })
    .meta({ ref: "Question" })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Asked: Bus.event(
      "question.asked",
      z.object({
        sessionID: z.string(),
        question: Info,
      }),
    ),
    Answered: Bus.event(
      "question.answered",
      z.object({
        sessionID: z.string(),
        questionID: z.string(),
        answers: z.record(z.string(), z.string()),
      }),
    ),
  }

  const pending = new Map<string, { resolve: (answers: Record<string, string>) => void; reject: (error: Error) => void }>()

  export async function ask(input: {
    sessionID: string
    messageID: string
    callID?: string
    questions: QuestionItem[]
  }): Promise<Record<string, string>> {
    const id = `q_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const info: Info = {
      id,
      sessionID: input.sessionID,
      messageID: input.messageID,
      callID: input.callID,
      questions: input.questions,
      status: "pending",
      time: {
        created: Date.now(),
      },
    }

    await Storage.write(["question", input.sessionID, id], info)
    Bus.publish(Event.Asked, { sessionID: input.sessionID, question: info })

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })

      // Timeout after 5 minutes
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id)
          reject(new Error("Question timed out"))
        }
      }, 5 * 60 * 1000)
    })
  }

  export async function answer(input: {
    sessionID: string
    questionID: string
    answers: Record<string, string>
  }) {
    const stored = await Storage.read<Info>(["question", input.sessionID, input.questionID])
    if (!stored) {
      throw new Error(`Question ${input.questionID} not found`)
    }

    stored.status = "answered"
    stored.answers = input.answers
    stored.time.answered = Date.now()

    await Storage.write(["question", input.sessionID, input.questionID], stored)
    Bus.publish(Event.Answered, {
      sessionID: input.sessionID,
      questionID: input.questionID,
      answers: input.answers,
    })

    const resolver = pending.get(input.questionID)
    if (resolver) {
      resolver.resolve(input.answers)
      pending.delete(input.questionID)
    }
  }

  export async function cancel(input: { sessionID: string; questionID: string }) {
    const stored = await Storage.read<Info>(["question", input.sessionID, input.questionID])
    if (!stored) return

    stored.status = "cancelled"
    await Storage.write(["question", input.sessionID, input.questionID], stored)

    const resolver = pending.get(input.questionID)
    if (resolver) {
      resolver.reject(new Error("Question cancelled by user"))
      pending.delete(input.questionID)
    }
  }

  export async function list(sessionID: string): Promise<Info[]> {
    const keys = await Storage.list(["question", sessionID])
    const questions = await Promise.all(
      keys.map(async (key) => {
        return Storage.read<Info>(["question", sessionID, key[key.length - 1]])
      }),
    )
    return questions.filter((q): q is Info => q !== null)
  }

  export async function get(sessionID: string, questionID: string): Promise<Info | null> {
    return Storage.read<Info>(["question", sessionID, questionID])
  }
}
