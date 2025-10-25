import z from "zod/v4"
import { Tool } from "./tool"
import DESCRIPTION from "./askuserquestion.txt"
import { Question } from "../session/question"

export const AskUserQuestionTool = Tool.define("askuserquestion", {
  description: DESCRIPTION,
  parameters: z.object({
    questions: z
      .array(Question.QuestionItem)
      .min(1)
      .max(4)
      .describe("Questions to ask the user (1-4 questions)"),
    answers: z
      .record(z.string(), z.string())
      .optional()
      .describe("User answers collected by the component (do not provide this in your request)"),
  }),
  async execute(params, opts) {
    // If answers are already provided (from a previous call), return them
    if (params.answers) {
      return {
        title: `Received answers for ${params.questions.length} question(s)`,
        output: JSON.stringify(params.answers, null, 2),
        metadata: {
          questions: params.questions,
          answers: params.answers,
        },
      }
    }

    // Ask the questions and wait for answers
    const answers = await Question.ask({
      sessionID: opts.sessionID,
      messageID: opts.messageID,
      callID: opts.callID,
      questions: params.questions,
    })

    return {
      title: `Received answers for ${params.questions.length} question(s)`,
      output: JSON.stringify(answers, null, 2),
      metadata: {
        questions: params.questions,
        answers,
      },
    }
  },
})
