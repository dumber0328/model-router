import { expect, test } from 'claude-code/testing'

const ok = (model: string) => ({
  turnId: 't',
  index: 0,
  answer: 'ok',
  toolUses: [],
  stopReason: 'end_turn',
  usage: { model },
})

function engine(on: any, fail: 'none' | 'null' | 'throw' | 'late' = 'none') {
  const models: string[] = []
  const statuses: (string | undefined)[] = []
  const toasts: string[] = []

  on('agent.list', () => ({
    value: [
      { id: 'find', type: 'general-purpose', description: '파일 찾기', status: 'running' },
      { id: 'named', type: 'x', description: 'y', name: '목록 담당', status: 'running' },
      { id: 'write', type: 'general-purpose', description: '원고 쓰기', status: 'running' },
    ],
  }))
  on('clock.after', () => ({ value: undefined }))
  on('ui.status', (_: unknown, e: { text?: string }) => {
    statuses.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', (_: unknown, e: { text: string }) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('turn.step', async function* (_: unknown, e: { model: string }) {
    models.push(e.model)
    if (e.model === 'haiku' && fail === 'throw') {
      throw new Error('bad model')
    }
    if (e.model === 'haiku' && fail === 'null') {
      return { ...ok(e.model), answer: '', stopReason: null, usage: null }
    }
    yield { kind: 'text', index: 0, text: `from ${e.model}` }
    if (e.model === 'haiku' && fail === 'late') {
      throw new Error('cut')
    }

    return ok(e.model)
  })

  return { models, statuses, toasts }
}

async function step($: any, agentId?: string, model = 'opus') {
  const chunks: any[] = []
  const stream = $.turn.step({ turnId: 't', index: 0, model, messageCount: 1, agentId })

  try {
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
  } catch {
    chunks.push('threw')
  }

  return chunks
}

test('the main conversation is never changed', async ($, on) => {
  const { models, statuses } = engine(on)

  await step($)
  expect(models).toEqual(['opus'])
  expect(statuses).toEqual([])
})

test('a matching subagent goes to the light model and shows the status', async ($, on) => {
  const { models, statuses, toasts } = engine(on)

  await step($, 'find')
  await step($, 'find')
  expect(toasts).toEqual(['→ 가벼운 모델'])
  await step($, 'named')
  expect(models).toEqual(['haiku', 'haiku', 'haiku'])
  expect(statuses[0]).toBe('→ 가벼운 모델')
})

test('other and unknown subagents keep their model', async ($, on) => {
  const { models, statuses } = engine(on)

  await step($, 'write')
  await step($, 'nobody')
  expect(models).toEqual(['opus', 'opus'])
  expect(statuses).toEqual([])
})

test('already light is left alone', async ($, on) => {
  const { statuses } = engine(on)

  await step($, 'find', 'claude-haiku-5-5')
  expect(statuses).toEqual([])
})

for (const fail of ['throw', 'null'] as const) {
  test(`a ${fail} failure resends on the original and stays there`, async ($, on) => {
    const { models } = engine(on, fail)
    const chunks = await step($, 'find')

    expect(models).toEqual(['haiku', 'opus'])
    expect(chunks.map(chunk => chunk.text).filter(Boolean)).toEqual(['from opus'])
    expect(chunks.some(chunk => chunk.kind === 'engine')).toBe(false)
    await step($, 'find')
    expect(models).toEqual(['haiku', 'opus', 'opus'])
  })
}

test('a failure after the answer started is not resent', async ($, on) => {
  const { models } = engine(on, 'late')
  const chunks = await step($, 'find')

  expect(models).toEqual(['haiku'])
  expect(chunks.includes('threw')).toBe(true)
})
