# Earth Pulse

전 세계 규모 4.0 이상 지진을 한국 시간 기준으로 하루 단위로 모아 보여 주는 기록판입니다. 별도 서버 없이 GitHub Actions가 3시간마다 USGS 공개 데이터를 수집하고, GitHub Pages가 정적 사이트로 보여 줍니다.

- 사이트: https://prjsghq7.github.io/earth-pulse/
- 포트폴리오: https://prjsghq7.github.io/ (AI 활용 › Earth Pulse)

## 주요 기능

- **지도:** 하루 동안 발생한 지진을 세계 지도 위에 규모별로 표시
- **기록 탐색:** 날짜별 기록 검색 · 정렬 · 페이지 이동
- **상세 화면:** 지진별 위치 · 규모 · 발생 시각(KST)
- **주소 공유:** 지도에 걸어 둔 날짜와 필터가 주소에 담겨, 링크 하나로 같은 화면을 공유
- **수집 상태:** 마지막 수집 시각과 다음 예정 시각 표시, 페이지를 열어 둔 상태에서도 1분마다 새 데이터 확인

## 데이터 원칙

| 원칙 | 내용 |
|---|---|
| 단일 공개 원천 | [USGS ComCat FDSN Event API](https://earthquake.usgs.gov/fdsnws/event/1/)만 사용 |
| 한국 시간 기준 | 하루의 경계와 수집 스케줄 모두 `Asia/Seoul` 기준 |
| 확정값끼리만 비교 | 하루가 끝나 확정된 기록끼리만 비교하고, 진행 중인 날은 따로 표시 |
| 실패해도 덮어쓰지 않음 | 수집이 실패하면 마지막 정상 데이터를 그대로 유지 |
| 추정하지 않음 | 없는 값은 비워 두고 만들어 내지 않음 |

## 기술 스택

React 19 · TypeScript · Vite · Tailwind CSS · d3-geo · Recharts · GitHub Actions · GitHub Pages

## 실행 방법

Node.js 22 기준입니다.

```bash
npm install
npm run dev
```

| 명령 | 설명 |
|---|---|
| `npm run build` | 정적 사이트 빌드 |
| `npm run data:collect` | USGS에서 최신 데이터 수집 |
| `npm run data:backfill` | 과거 기간 데이터 채우기 |
| `npm run data:verify` | 저장된 데이터 무결성 검사 |
| `npm run data:verify:failures` | 수집 지연 · 실패 상황 복구 시나리오 검사 |
| `npm run lint` | oxlint 검사 |

## 구조

```text
app/                 화면 (지도 · 기록 탐색 · 상세)
components/ui/       공용 UI 컴포넌트
lib/
├─ earth-pulse-data.ts  데이터 불러오기 · 집계
└─ map-sharing.ts       지도 필터 ↔ 주소 변환
scripts/             수집 · 백필 · 검증 스크립트
public/data/         수집된 데이터 (daily · events · index, status.json, manifest.json)
```

## 자동화

| 워크플로 | 하는 일 |
|---|---|
| `refresh-earthquake-data.yml` | KST 0시 10분부터 3시간 간격으로 실패 시나리오 검사 → 수집 → 검증 → 바뀐 데이터만 커밋 |
| `deploy-pages.yml` | 데이터 갱신 또는 코드 변경 후 사이트를 빌드해 GitHub Pages에 배포 |

## 만든 방식

K-뉴딜 SKT ALEPH 과정의 AI 활용 과제입니다. 수집 · 집계 구조와 화면 구현은 AI에게 맡기고, 공개 원천을 USGS로 고정하는 것, 확정값끼리만 비교하고 없는 값은 추정하지 않는 원칙, 서버 없이 GitHub Pages와 Actions만으로 운영하는 구조는 직접 정했습니다.
