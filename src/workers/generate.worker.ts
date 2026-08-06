/// <reference lib="webworker" />

import { generatePattern } from '../core/generate'
import type { WorkerRequest, WorkerResponse } from '../types'

const context = self as DedicatedWorkerGlobalScope

context.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'generate') return
  const { taskId, grid, settings } = event.data
  try {
    const result = generatePattern(grid, settings, {
      onProgress(stage, progress) {
        const response: WorkerResponse = { type: 'progress', taskId, stage, progress }
        context.postMessage(response)
      },
    })
    const response: WorkerResponse = { type: 'complete', taskId, result }
    context.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      taskId,
      message: error instanceof Error ? error.message : '生成过程中发生未知错误。',
    }
    context.postMessage(response)
  }
})
