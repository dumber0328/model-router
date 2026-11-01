# model-router

Claude Code의 서브에이전트 중 이름·종류·맡은 일에 "찾기", "목록", "검색"이 들어간 것을 가벼운 모델로 보내는 mod입니다. 나머지 서브에이전트와 메인 대화는 지금 모델을 그대로 씁니다.

## 설치

터미널 세션의 입력창에서:

```
/plugin install model-router --marketplace dumber0328/model-router
```

마켓플레이스를 추가할지 물으면 `y`를 누르고, 설치 범위를 고릅니다.

셸에서:

```bash
claude plugin install model-router --marketplace dumber0328/model-router
```

## 바꾸기

`hooks/register.ts` 맨 위에서 고칩니다.

- `LIGHT_MODEL`: 보낼 모델 (`haiku` 같은 별칭이나 전체 이름)
- `LIGHT_WORDS`: 가벼운 모델로 보낼 단어
- `STATUS_TEXT`, `STATUS_MS`: 표시 문구와 상태줄 표시 시간

## 동작

- 모델을 바꾸면 상태줄에 표시하고, 에이전트마다 한 번 알림을 띄웁니다. Code 탭에서는 상태줄 표시가 보이지 않았고 알림은 보였습니다.
- 답이 나오기 전에 가벼운 모델 요청이 실패하면 원래 모델로 다시 보내고, 그 에이전트는 이후에도 원래 모델을 씁니다. 답이 나오기 시작한 뒤의 실패는 다시 보내지 않습니다.
- 대화 내용과 에이전트의 긴 지시문은 읽지 않으며, 인터넷 요청을 직접 하지 않습니다.

## 알아 둘 점

- 글자가 그대로 들어 있어야 합니다. "찾아보기"나 "Explore"는 "찾기"에 걸리지 않습니다.
- 이름에 단어가 들어가면 일의 난이도와 상관없이 가벼운 모델로 갑니다.
- 실패 시 재전송은 흉내 낸 실패로만 시험했습니다. 실제 API 에러로는 아직 시험하지 않았습니다.
- 만든 사람의 Claude Code 2.1.309, macOS 환경에서 시험했습니다.

## 끄기

```bash
claude plugin uninstall model-router
```
