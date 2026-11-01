// 규칙에 맞는 서브에이전트가 쓸 모델입니다. haiku, sonnet 같은 별칭이나 전체 이름을 쓸 수 있습니다.
const LIGHT_MODEL = 'haiku'
// 서브에이전트의 이름·종류·맡은 일에 이 단어가 들어 있으면 가벼운 모델로 보냅니다.
const LIGHT_WORDS = ['찾기', '목록', '검색']
// 상태줄과 알림에 보여 줄 문구와 시간입니다. Code 탭에서는 상태줄이 보이지 않아 알림도 함께 띄웁니다.
const STATUS_TEXT = '→ 가벼운 모델'
const STATUS_MS = 3000

import type { EngineInterface, Register } from 'claude-code'

async function isLightAgent($: EngineInterface, agentId: string) {
  const agents = await $.agent.list()
  const agent = agents.find(one => one.id === agentId)

  if (!agent) {
    return undefined
  }

  const label = [agent.name ?? '', agent.type, agent.description].join(' ').toLowerCase()

  return LIGHT_WORDS.some(word => label.includes(word.toLowerCase()))
}

export const register: Register = on => {
  const decided = new Map<string, boolean>()
  const announced = new Set<string>()

  on('turn.step', async function* ($, e, next) {
    const { agentId } = e

    // 메인 대화는 건드리지 않습니다.
    if (agentId === undefined) {
      return yield* next(e)
    }

    if (!decided.has(agentId)) {
      const isLight = await isLightAgent($, agentId).catch(() => undefined)

      if (isLight !== undefined) {
        decided.set(agentId, isLight)
      }
    }

    if (!decided.get(agentId) || e.model.toLowerCase().includes(LIGHT_MODEL.toLowerCase())) {
      return yield* next(e)
    }

    $.ui.status(STATUS_TEXT)
    // 요청마다 띄우면 번거로우므로 에이전트마다 한 번만 띄웁니다.
    if (!announced.has(agentId)) {
      announced.add(agentId)
      $.ui.toast(STATUS_TEXT)
    }
    $.clock.after(STATUS_MS, () => $.ui.status(undefined))

    // 답이 나오기 전까지 엔진 표시를 잡아 둡니다. 실패하면 버리고 다시 보내기 위해서입니다.
    const stream = next({ ...e, model: LIGHT_MODEL })
    const held: Awaited<ReturnType<typeof stream.next>>['value'][] = []
    let hasStarted = false
    let failed = false

    try {
      for await (const chunk of stream) {
        if (!hasStarted && chunk.kind === 'engine') {
          held.push(chunk)
          continue
        }
        if (!hasStarted) {
          hasStarted = true
          yield* held as never[]
        }
        yield chunk
      }
    } catch (error) {
      if (hasStarted || next.signal.aborted) {
        throw error
      }
      failed = true
    }

    const result = failed ? undefined : await stream.result

    // stopReason이 없으면 응답이 오지 않은 것입니다. 사람이 중단한 경우는 다시 보내지 않습니다.
    if (!hasStarted && !next.signal.aborted && (failed || result?.stopReason === null)) {
      decided.set(agentId, false)
      $.ui.status(undefined)

      return yield* next(e)
    }

    if (!hasStarted) {
      yield* held as never[]
    }

    return result
  })
}
