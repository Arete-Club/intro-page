# Arete Club 소개 웹 — 진행 기록

## 완료된 것

### 2026-10-16 — `docs/motion.md` 구현 (Interactive Ocean Landing Page)

- 사용자 결정(이번 세션):
  - motion.md 팔레트 채택. `#061521` / `#0A2638` / `#12465E` / `#81B7C8` / `#F1F4F2`이며, 기존 paper·sky·navy 시안값을 대체함.
  - 연구 관심 분야는 기존 4개 유지. motion.md의 3개 안은 채택하지 않음.
  - Phase 1–4 일괄 진행.
- 링크: 사용자가 SkillFetch(`Arete-Club/SkillFetch`), Handoff(`Arete-Club/handoff-skill`) URL을 제공함. GitHub API로 두 저장소와 조직 `Arete-Club`이 공개 상태임을 확인함.
  - Sentinel은 비공개 저장소라 링크 없음.
  - Handoff 프로젝트 카드를 추가함. 설명은 README 첫 문장을 근거로 작성함.
  - 상태(status)는 모두 `null` 유지.
- motion.md가 SPEC v1의 I01, §2 제외 항목, 결정 C, 히어로 카피를 대체함. 대체 내역은 `docs/SPEC.md` 상단 갱신 메모에 기록. I02–I07은 유지.
- 구조:
  - `src/components/OceanExperience.astro`: 고정 스테이지와 장면 문구.
  - `src/scripts/ocean/`
    - `timeline.ts`: 순수 함수. 카메라 경로, 안개, 빛, 문구 표시 구간을 계산.
    - `scene.ts`, `water.ts`, `environment.ts`, `glsl.ts`: 렌더링.
    - `mount.ts`: ScrollTrigger 연결, 수명주기, 대체 경로.
    - `color.ts`
  - 본문은 01 About / 02 Research / 03 Projects / 04 Open Exploration / Footer.
- 설계 판단(대안과 이유):
  - 카메라는 Fritsch–Carlson 단조 3차 보간을 씀. 키프레임을 넘어서는 오버슈트가 없어 수면 아래로 내려간 뒤 다시 떠오르지 않음. Catmull-Rom은 오버슈트 위험이 있어 쓰지 않음.
  - 수면 통과는 카메라 높이에 연동한 안개·광량 연속 보간에, 카메라 바로 앞의 경계선 평면(물 위/물속 분할)을 더함. 화면 전체 색 전환 방식은 motion.md가 금지함.
  - 히어로 글자는 남색(Primary Background)을 씀. 흰 글자는 수평선 근처의 밝은 하늘에서 대비 4.5:1이 안 나옴.
  - 헤더 글자색은 장면 대비로 남색과 흰색을 전환함. 수중에서는 상단 음영을 깜.
  - 하늘은 Muted Cyan에서 파생해 추가 HEX 토큰을 만들지 않음.
  - 셰이더는 직접 작성함. three의 Water.js는 노멀맵 텍스처(외부 에셋)가 필요해 쓰지 않음.
  - 그리기 호출은 6개: 하늘, 수면, 해저, 광선(병합 1회), 입자(Points 1회), 경계선.
- 보정 과정에서 고친 결함:
  - 공유 파도 GLSL에서 `QUALITY` 정의 누락으로 셰이더 컴파일이 실패함 → `#ifdef`로 수정.
  - 셰이더 실패 시 대체 화면으로 가지 않던 문제 → `onShaderError` 감지 + 대체 화면 테스트 추가.
  - 역스크롤 시 문구 투명도가 0.998에서 멈춤 → 기록된 값 기준 비교로 수정. T04가 회귀 검사함.
  - 스크롤 안내 문구가 가운데에서 벗어남.
  - h1 두 span 사이 공백 누락("Arete ClubBeyond").
  - 수면 통과 직후 첫 프레임 정지(GPU 파이프라인 생성) → 초기화 시 예열 렌더 1회 추가.
- 검증:
  - 통과: `npm run check` 0/0/0, `npm run lint` 0, `npm run test` 27개, `npm run build` 성공, `npm run test:e2e` 14개, `npm run test:visual` 1개.
  - 사용자 승인 후 구 파일 4개를 삭제함: `src/scripts/hero.ts`, `horizon-scene.ts`, `scroll-state.ts`, `tests/unit/scroll-state.test.ts`. 삭제 전에는 구 테스트가 없어진 `--paper` 토큰을 읽어 `npm run test`가 실패했음. 삭제 후 전체 재검증 통과.
- Git: 비어 있던 비공개 저장소 `Arete-Club/intro-page`의 `develop` 브랜치에 첫 커밋으로 push함. main 브랜치는 만들지 않음.
- 시각 검토: 1440×900, 375×667에서 표면 / 통과 / 하강 / 심해와 본문 섹션, 정적 대체 화면을 실제 캡처로 확인함. 태양 크기, 해저 가시성, 수중 상하 밝기 차이를 보정함.
- 성능(로컬 측정, 실기기 보장 아님):
  - 실제 GPU(Apple M4 Pro, ANGLE Metal), 스크롤 180프레임:
    - 1440×900@2x(캔버스 2160×1350): 중앙값 16.7ms / p95 17.6ms / 최대 18–20ms
    - 1920×1080@2x: 중앙값 16.7ms / p95 17.5ms
    - 390×844@3x: 중앙값 16.7ms / p95 17.6ms
  - Playwright 기본 설정(SwiftShader 소프트웨어 렌더링)에서는 1440px 중앙값 약 37ms. 테스트 환경의 수치일 뿐 GPU 성능이 아님.
- 번들: 초기 스크립트 6.9KB(gzip 3.4KB). 3D 장면 청크 538KB(gzip 133KB)는 지연 로딩되며, 500KB 경고는 유지됨.

### 2026-10-15 — SPEC v1 (히어로 부분은 위 motion.md 구현으로 대체됨)

- 2026-10-15: 브랜드 원문 `arete-club-brand-identity-prd.md` 확인. 원문은 변경하지 않음.
- 사용자 합의: 히어로에만 3D, 추상적인 수평선·공간의 깊이, 흰색 → 하늘색 → 남색 전환, 본문 남색·밝은 글자·넓은 여백.
- 사용자 합의: Astro + TypeScript + Three.js + GSAP ScrollTrigger + CSS 변수 채택. 이번 프로젝트에서 Astro 사용.
- 콘텐츠 기준: Hero → About → What We Explore → Projects → Contact / Footer. 브랜드와 개별 프로젝트·연구 관심 분야를 구분.
- `SPEC.md` v1 검토용 초안 작성. 기존 v0의 Next.js·두 섹션·Sentinel Club/Forge 분리 카드 전제를 개정.
- 채택하지 않은 대안: 전체 페이지 탐험형 3D는 가독성 때문에 제외. 중앙 조형물 대신 공간 중심 수평선 선택. 본문의 밝은 배경 복귀 대신 남색 유지.
- 문서 검증: Python unittest 7개 통과. 합의 추적·검증 ID·미결 결정 시점·참조 파일·브랜드 원문 보존·핸드오프 구조·Markdown 구조를 검사함. 재실행 스크립트는 임시 경로 `/tmp/arete-spec-review/validate_spec.py`이며 앱 테스트가 아님.
- Markdown 구조 검사 통과: 코드 펜스·표 열 수·제목 간격·후행 공백. 전용 markdownlint는 사용하지 않음.
- 자체 검토 1회: 실제 v0→v1 변경과 대화·브랜드 PRD를 대조. 합의한 히어로 범위·색상 흐름·남색 본문·콘텐츠·Astro 스택에서 이탈 없음. 기존 v0 및 브랜드 PRD와 달라진 부분은 SPEC §3에 명시.
- 세부 동작·접근성 대체 경로·검증 도구는 신규 구현 제안으로 표시. 정확한 색상값·서체·링크·프로젝트 상태는 확정된 것으로 쓰지 않음.
- 이후 사용자 요청으로 SPEC v1 구현 승인. 추가 사용자 디자인 검수 없이 자체 테스트·시각 검증까지 수행.
- `feat/astro-landing` 브랜치에서 Astro 7.3.8 + TypeScript 5.9.3 + Three.js 0.186.1 + GSAP 3.15.0 구현. 의존성 버전과 lockfile 고정. 커밋·push·공개 배포는 수행하지 않음.
- 정적 콘텐츠: Hero / About / Research / Projects / Footer 구현. Sentinel·SkillFetch 카드 2개와 연구 관심 분야 4개. 공식 링크·상태는 `null`로 유지.
- 히어로: 추상적 곡면·등고선, 흰색 → 하늘색 → 남색, 스크롤 시점 변화, 남색 본문으로 연결. 글자·CTA는 HTML. 기본 스크롤을 유지하고 별도 스무스 스크롤을 도입하지 않음.
- 접근성: JS 비활성·모션 감소·WebGL 초기화 실패·컨텍스트 손실·모듈 로딩 실패 대체 경로, 키보드·앵커 탐색, 화면 크기 변경·화면 이탈·숨김 상태 처리.
- 렌더링은 스크롤·크기·가시성 변경 시에만 요청하며, 화면 밖·숨겨진 문서에서는 중지. 모바일 캔버스 해상도·곡면 분할 수 축소.
- 가독성 보정: 본문·설명 16px 이상, 글자 영역의 배경을 실제 콘텐츠 높이에 맞춰 확보. 배경색 진행도 1,001개 표본에서 글자 대비 4.5:1 이상 확인.
- 검증 통과: `npm run check` 오류·경고·힌트 0, `npm run lint` 오류·경고 0, `npm run test` 17개 통과, `npm run build` 성공, `npm run test:e2e` 13개 통과, `npm run test:visual` 1개 통과.
- 스펙 항목 대조: T01 정적 HTML / T02 데이터·링크 / T03 경계·역스크롤 계산 / T04 실제 캔버스·색상 연결 / T05 375×667·375×900·768×900·1440×900 배치 / T06 접근성 / T07 대체 경로 / T08 수명주기 / T09 메타데이터 — 각 검사 통과.
- V01: 데스크톱·모바일의 히어로 세 지점과 About·Research·Projects·Footer 캡처 생성. 실제 이미지를 검토하여 글자 잘림·겹침·색상 단절 없음 확인. 모바일은 Chromium 뷰포트 에뮬레이션이며 실기기 검증이 아님. 문서 숨김 테스트는 visibility 상태를 시뮬레이션함.
- 로컬 렌더링 프로파일: 45회 스크롤 프레임 표본. 1440px 중앙값 16.7ms / p95 17.4ms / 최대 20.8ms, 375px 중앙값 16.7ms / p95 17.4ms / 최대 17.7ms. 측정 환경에 한정된 결과이며 실제 모바일 성능 보장이 아님.
- 구현 자체 검토 1회: 실제 신규 코드 diff와 SPEC 대조. 본문 최소 글자 크기·텍스트 배경 확보·3D 색상 토큰 관리 문제를 보정하고 관련 검사를 재실행. I01–I08 유지, 미해결 기능 범위 이탈 없음. 브랜드 원문 변경 없음.
- 실행 방법은 `README.md`, 유지용 첫 화면 캡처와 프로파일은 `artifacts/preview/`에 저장. 세부 검증 캡처는 `test-results/`에 있으며 테스트 재실행 시 교체될 수 있음.

## 진행 중인 것

- `artifacts/preview/`의 캡처·프로파일은 2026-10-15 구 히어로 기준임. 새 캡처는 `npm run test:visual` 결과(`test-results/`)에 있음.
- 공개 배포는 미착수.
- 빌드 제한: Three.js 장면 지연 로딩 청크 537,613 bytes / 로컬 gzip 133,347 bytes. 500KB 청크 경고는 남아 있음. 초기 HTML·본문은 이 청크 로딩과 독립적임.
- 개발 도구 제한: Node 22.21.0에 맞춰 ESLint 9.39.5 + eslint-plugin-astro 1.3.1 사용. 최신 플러그인은 Node 22.22.3 이상을 요구함. 온라인 npm audit는 braces → micromatch → fast-glob → astro-eslint-parser 체인 high 4건을 보고했고 `npm audit fix`는 해소하지 못함. 오프라인 lockfile 갱신 때 표시된 0건은 온라인 재검증 근거로 사용하지 않음.

## 다음 단계

- 로컬 실행: `npm run dev`. 의존성 재설치는 `npm ci`. 실행·검증 상세는 `README.md` 참조.
- 저장소가 비어 있었으므로 GitHub 기본 브랜치는 `develop`이 됨. main을 만들고 기본 브랜치·보호 규칙을 정할지는 사용자 결정 사항.
- 사용자 시각 검수: 수면 통과 속도(구간 0.25–0.35), 시퀀스 길이(데스크톱 520svh·모바일 440svh), 광선·입자 밀도.
- 실제 기기·Safari(특히 iOS WebGL) 검증, 추가 최적화 또는 배포는 후속 요청 범위에서 진행.
- Node 런타임을 갱신할 때 현재 지원되는 린트 도구 체인과 npm 감사 경고 재검토.

## 미결 결정사항

- 색상: 2026-10-16 motion.md 팔레트로 교체됨(위 기록). 브랜드 영구 가이드 확정 여부는 별개이며, 서체는 계속 시스템 산세리프.
- 공개 정보 노출 전: Sentinel 공개 시 URL, 각 프로젝트 상태(SkillFetch README에는 "experimental MVP"로 적혀 있으나 게시 여부는 미결), 이메일.
- 공개 배포 전: 호스팅·도메인·공유 이미지. 로고 미제공 시 텍스트 브랜드명 사용.
