# Arete Club 소개 웹

Astro 정적 랜딩 페이지입니다. 첫 화면은 해수면에서 심해까지 스크롤로 내려가는 Three.js 장면입니다. 연출 기준은 [motion.md](docs/motion.md)입니다. GSAP ScrollTrigger가 스크롤 진행도를 카메라와 환경에 연결합니다. 본문은 JavaScript 없이도 읽을 수 있습니다.

## 실행

Node.js 22.12 이상이 필요합니다. 이 프로젝트는 Node.js 22.21.0에서 검증했습니다.

```sh
npm ci
npm run dev
```

터미널에 표시되는 로컬 주소를 엽니다. 기본 포트는 4321입니다. Astro가 에이전트 환경에서 서버를 백그라운드로 실행한 경우 `npm run dev -- stop`으로 종료합니다.

## 검증

```sh
npm run check
npm run lint
npm run test
npm run build
npx playwright install chromium --only-shell
npm run test:e2e
npm run test:visual
```

브라우저 테스트는 4322 포트에서 빌드된 `dist/`를 제공합니다. 캡처와 렌더링 프로파일은 `test-results/`에 생성되며, 다음 테스트 실행 시 교체될 수 있습니다. 모바일 검사는 브라우저 뷰포트 에뮬레이션입니다. 테스트 브라우저는 소프트웨어 WebGL(SwiftShader)로 렌더링합니다. 따라서 `test:visual`의 프레임 간격은 실제 GPU 성능이 아닙니다.

## 수정할 곳

- `src/data/content.ts`: 프로젝트, 연구 분야, 확인된 공식 링크. 미확인 값은 `null`로 유지합니다.
- `src/pages/index.astro`: 본문 카피, 섹션, 메타데이터.
- `src/components/OceanExperience.astro`: 바다 시퀀스의 장면 문구와 헤더.
- `src/styles/global.css`: 색상 토큰(motion.md §6), 여백, 서체, 반응형 배치. 3D 장면도 이 파일의 색상 토큰을 읽습니다.
- `src/scripts/ocean/timeline.ts`: 스크롤 진행도에 따른 카메라 경로, 안개, 빛, 문구 표시 구간. 순수 함수이며 단위 테스트 대상입니다.
- `src/scripts/ocean/scene.ts`, `water.ts`, `environment.ts`, `glsl.ts`: 렌더러, 수면 셰이더, 하늘, 해저 지형, 광선, 입자, 리소스 정리.
- `src/scripts/ocean/mount.ts`: ScrollTrigger 연결, 화면 크기 변경, 모션 감소, 실패 시 대체 표시.

## 문서

- [연출 스펙 — motion.md](docs/motion.md)
- [구현 스펙 v1](docs/SPEC.md): 히어로 관련 항목은 motion.md로 대체되었습니다.
- [진행 상황과 검증 결과](PROGRESS.md)
- [브랜드 원문](docs/arete-club-brand-identity-prd.md)

이메일은 아직 제공되지 않아 화면에서 생략했습니다. Sentinel 저장소는 비공개라 링크를 넣지 않았습니다. 호스팅과 공개 배포는 구성하지 않았습니다.

Three.js 장면 청크는 지연 로딩되며 약 538KB(로컬 gzip 약 133KB)입니다. 이 크기 때문에 빌드 시 500KB 경고가 표시됩니다. 현재 Node와 호환되는 린트 도구의 전이 의존성에서 npm 온라인 감사가 high 4건을 보고했고, `npm audit fix`로는 해소되지 않았습니다. 상세 검증 범위와 제한은 `PROGRESS.md`에 기록했습니다.
