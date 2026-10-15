# Arete Club — Interactive Ocean Landing Page

## 1. 프로젝트 개요

Arete Club은 인공지능 연구 및 오픈소스 개발을 수행하는
독립적인 AI Research & Development 조직이다.

이번 작업의 목표는 Arete Club의 브랜드 철학을
3D 인터랙티브 웹사이트로 표현하는 것이다.

핵심 콘셉트:

"Beyond the Surface."

바다는 인간과 가장 가까우면서도 아직 많은 부분이
탐험되지 않은 미지의 공간이다.

Arete Club은 바다처럼 알려지지 않은 지능의 영역을
끊임없이 탐구하는 연구 조직이다.

이 철학을 시각적으로 전달하기 위해 사용자가
스크롤하면서 해수면에서 심해로 내려가는
몰입형 웹 경험을 구현한다.

디자인 키워드:
- Cinematic
- Minimalism
- Ocean Exploration
- Scientific Research
- Subtle Retro
- Premium Editorial Design

중요:
일반적인 AI 스타트업 랜딩 페이지처럼 제작하지 않는다.
과도한 글래스모피즘, 그라디언트 카드, 네온 효과를 피한다.

시각적으로 아름답지만 절제된 연구 조직의 분위기를 유지한다.


## 2. 기술 스택

기존 프로젝트의 프레임워크와 구조를 먼저 분석한다.

React 기반 프로젝트라면 다음 구성을 우선 검토한다.

- TypeScript
- Three.js
- React Three Fiber
- @react-three/drei
- GSAP + ScrollTrigger
- Tailwind CSS (기존 프로젝트에 있다면 활용)

다른 라이브러리가 이미 동일한 기능을 제공한다면
불필요하게 새로운 의존성을 추가하지 않는다.

영상, 이미지 시퀀스, AI 생성 영상은 사용하지 않는다.

바다와 수중 환경을 Three.js로 실시간 렌더링한다.

가능한 한 Procedural Geometry와 Shader를 활용한다.

초기 구현에서는 외부 3D 모델 다운로드 없이
구현할 수 있는 방향을 우선한다.


## 3. 핵심 사용자 경험

사용자는 웹사이트에 접속하면
고요한 바다의 해수면을 바라보게 된다.

마우스를 스크롤하면 카메라가 천천히 전진하면서
수면 아래로 내려간다.

수면을 통과하는 순간 환경이 자연스럽게 변화한다.

수중에서는 빛이 산란되고,
작은 입자들이 공간을 떠다닌다.

스크롤을 계속하면 빛이 서서히 사라지고
짙은 남색의 심해가 나타난다.

마지막에는 Arete Club의 철학과 연구 프로젝트가
소개되는 웹페이지로 연결된다.

전체 연출은 하나의 연속적인 카메라 이동처럼 보여야 한다.

장면 전환이나 순간적인 카메라 이동은 피한다.


## 4. Scene Architecture

### Scene 01 — The Surface

스크롤 진행도: 0~20%

첫 화면은 고요한 해수면이다.

환경:
- 광활한 바다
- 잔잔한 파도
- 은은한 자연광
- 부드러운 수평선
- 차분한 푸른색 하늘

카메라:
- 해수면 바로 위에 위치
- 수평선을 바라보는 시점
- 매우 느린 움직임
- 과도한 카메라 흔들림 없음

렌더링:
- 절제된 Water Shader
- 파도의 미세한 움직임
- 자연스러운 빛 반사
- 적절한 Fog

HTML Overlay:

ARETE CLUB

Beyond the Surface.

Independent AI Research & Development

하단에 작은 Scroll to Explore 인디케이터 표시.

타이포그래피는 크고 미니멀하게 구성한다.

스크롤이 시작되면 텍스트는 서서히 사라진다.


### Scene 02 — Crossing the Surface

스크롤 진행도: 20~40%

사용자가 스크롤하면 카메라가
해수면을 향해 천천히 이동한다.

이후 카메라가 수면을 통과한다.

핵심 구현 요소:

1. 카메라 Y 좌표의 부드러운 감소
2. 해수면 통과 시 자연스러운 시각적 변화
3. Above Water / Underwater 환경 전환
4. 수면 아래에서 Fog 밀도 증가
5. 빛의 색상과 강도 변화

특히 수면 통과 순간이 중요하다.

화면이 갑자기 파란색으로 바뀌는 방식은 피한다.

카메라의 위치에 따라 수중 효과가
연속적으로 변화하도록 구현한다.

실제 카메라가 바닷속으로 진입하는 듯한
공간적 몰입감을 제공해야 한다.


### Scene 03 — The Descent

스크롤 진행도: 40~75%

카메라는 이제 수중에 있다.

사용자가 스크롤할수록
카메라가 점차 깊은 바닷속으로 내려간다.

환경:

- 깊고 푸른 바닷물
- 수면 위에서 들어오는 희미한 햇빛
- Volumetric Light처럼 보이는 광선
- 물속에 떠다니는 미세한 입자
- 멀리 희미하게 보이는 해저 지형
- 점점 어두워지는 환경

핵심 효과:

1. Underwater Fog
2. Light Attenuation
3. Floating Particles
4. Depth-based Color Grading
5. Camera Parallax

수심이 깊어질수록 빛의 강도가 감소한다.

색상은 밝은 Ocean Blue에서
Dark Navy로 자연스럽게 전환한다.

입자들은 과도하게 많지 않도록 한다.

입자와 지형을 통해 공간의 깊이감을 전달한다.

HTML Overlay:

"Explore the Unknown."

"We explore the frontiers of intelligence."

텍스트는 스크롤 위치에 따라
부드럽게 나타났다가 사라진다.


### Scene 04 — The Abyss

스크롤 진행도: 75~100%

카메라가 깊은 심해에 도달한다.

환경은 짙은 Midnight Navy 색상으로 전환된다.

완전한 검은색은 사용하지 않는다.

희미한 푸른빛과 작은 입자를 남겨
공간감을 유지한다.

이 구간에서 다음 메시지를 표시한다.

"Curiosity drives discovery."

"Excellence shapes what comes next."

카메라 이동은 점차 느려진다.

이후 자연스럽게 Research Section으로 전환한다.


## 5. Research Section

3D 시퀀스 이후에는 일반적인 웹 레이아웃으로 전환한다.

앞부분이 시네마틱하다면
이후 영역은 극도로 절제된 연구소 스타일로 구성한다.

배경:
Deep Navy 또는 Off White

구성:

01 — About Arete Club

독립적인 AI 연구 및 개발 조직 소개.

02 — Research

AI Agents
LLM Systems
Evaluation & Reliability

03 — Projects

Sentinel
SkillFetch

각 프로젝트에 간결한 설명과
GitHub 링크를 배치한다.

실제 정보가 확인되지 않은 프로젝트 설명이나
성과를 임의로 생성하지 않는다.

04 — Open Exploration

GitHub Organization 링크 및
연구 활동을 확인할 수 있는 CTA.

전체적으로 카드 남발을 피하고
타이포그래피와 여백 중심으로 디자인한다.


## 6. 디자인 시스템

Color Palette:

Primary Background:
#061521

Deep Ocean:
#0A2638

Ocean Blue:
#12465E

Muted Cyan:
#81B7C8

Off White:
#F1F4F2

기존 브랜드 컬러가 정의되어 있다면
그 값을 우선 사용한다.

Typography:

- 현대적인 Sans-serif
- 큰 헤드라인
- 넉넉한 자간과 여백
- 작은 Metadata에는 Monospace 활용

Visual Direction:

- Premium Editorial
- Minimal Research Laboratory
- Cinematic Ocean
- Subtle Film Grain

Retro 스타일은 과도하게 사용하지 않는다.

전체 분위기에서 약 10% 정도만 느껴지게 한다.

장식적인 요소보다 공간감과 타이포그래피를 우선한다.


## 7. Scroll Animation

GSAP ScrollTrigger를 이용하여
스크롤 진행도를 0~1 범위로 정규화한다.

스크롤 진행도에 따라 다음 값을 제어한다.

- Camera Position
- Camera Target
- Fog Density
- Environment Lighting
- Water Appearance
- Particle Visibility
- Scene Color
- HTML Text Opacity

3D Canvas는 스크롤 시퀀스 동안
Viewport에 고정한다.

권장 구조:

3D Scene
    └── Scroll-controlled Camera
          ├── Surface
          ├── Underwater Transition
          ├── Ocean Depth
          └── Abyss

HTML Overlay
    ├── Hero Title
    ├── Exploration Text
    └── Research Transition

Scroll Container
    └── GSAP ScrollTrigger

카메라 이동은 정해진 구간마다
끊기는 방식이 아니라 연속적인 곡선으로 구현한다.

스크롤을 위로 올리면 장면도 자연스럽게 역재생된다.

자동 재생 애니메이션과
스크롤 기반 카메라 이동을 명확하게 분리한다.

파도와 작은 입자는 시간에 따라 움직이되,
카메라 위치는 스크롤에 종속시킨다.


## 8. 성능 최적화

이 프로젝트는 실제 웹사이트이므로
시각적 품질만큼 성능을 중요하게 고려한다.

필수 사항:

- requestAnimationFrame 기반 렌더링
- GPU 친화적인 Shader
- 불필요한 Draw Call 최소화
- Geometry / Material 재사용
- InstancedMesh 또는 Points 활용
- Device Pixel Ratio 제한
- 모바일 환경 성능 최적화
- 불필요한 React Re-render 방지
- 이벤트 리스너 및 GPU 리소스 정리

거대한 3D 에셋이나 무거운 후처리 효과는 피한다.

광선 효과는 실제 Volumetric Rendering 대신
가벼운 Shader나 Geometry 기반으로 구현해도 된다.

모바일에서는 입자 수와 효과 품질을 낮춘다.

WebGL을 사용할 수 없거나
prefers-reduced-motion이 활성화된 환경에서는
정적인 대체 화면을 제공한다.


## 9. 구현 우선순위

처음부터 모든 효과를 구현하지 않는다.

Phase 1 — Core Experience

- 바다 수면 렌더링
- 카메라 스크롤 제어
- 수면 통과
- 수중 환경
- 심해 전환

이 단계에서는 장식보다
카메라 이동의 자연스러움을 검증한다.

Phase 2 — Visual Polish

- Light Rays
- Particles
- Water Shader 개선
- Fog 조정
- Color Grading
- Typography Animation

Phase 3 — Website Integration

- Hero Overlay
- About Section
- Research Section
- Projects Section
- Responsive Design

Phase 4 — Optimization

- GPU Performance
- Mobile Optimization
- Accessibility
- Code Cleanup

각 단계에서 가능한 한
작고 독립적인 컴포넌트로 구현한다.

불필요한 추상화와 오버엔지니어링을 피한다.


## 10. 작업 지침

1. 현재 프로젝트 구조와 의존성을 먼저 분석한다.
2. 기존 코드와 디자인 시스템을 최대한 재사용한다.
3. 구조를 간단히 정리한 뒤 구현을 시작한다.
4. 우선 동작하는 MVP를 완성한다.
5. 이후 시각적 디테일을 개선한다.
6. TypeScript 타입 안정성을 유지한다.
7. 실행 가능한 결과물을 제공한다.
8. 가능한 범위에서 빌드 및 기본 동작을 검증한다.
9. 변경 파일과 검증 결과를 마지막에 요약한다.

중요한 설계 원칙:

"Visual Quality Through Simplicity."

복잡한 기술을 사용하는 것이 목적이 아니다.

최소한의 코드와 렌더링 비용으로
가장 높은 수준의 시각적 경험을 제공하는 것이 목표다.

최종적으로 사용자가 웹사이트를 스크롤하면서
실제로 바닷속을 탐험하는 것 같은
몰입형 경험을 구현한다.
# Implementation Override — Astro Architecture

IMPORTANT:
The existing project is built with Astro.

Preserve the current Astro architecture.
Do not migrate to React, Next.js, or another framework.

## Technology Stack

- Astro (existing project)
- TypeScript
- Three.js (native)
- GSAP ScrollTriggerv
- CSS / existing styling system

Do NOT install:
- React
- React Three Fiber
- @react-three/drei

## Architecture

Separate static website content from interactive 3D rendering.

Astro:
- Page structure
- Navigation
- Typography
- Research sections
- Project listings
- SEO

Three.js:
- Ocean surface rendering
- Underwater environment
- Camera movement
- Custom shaders
- Atmospheric effects

GSAP:
- Scroll-driven animation
- Camera position interpolation
- Environmental transitions
- HTML overlay animations

## Suggested File Structure

src/
├── components/
│   ├── OceanExperience.astro
│   ├── Hero.astro
│   ├── Research.astro
│   └── Projects.astro
│
├── scripts/
│   └── ocean/
│       ├── scene.ts
│       ├── water.ts
│       ├── camera.ts
│       ├── environment.ts
│       └── scroll.ts
│
└── pages/
    └── index.astro

This structure is only a suggestion.
Inspect and reuse the existing project structure first.

## Rendering Strategy

1. Astro renders all static content.
2. Three.js initializes only in the browser.
3. The 3D canvas occupies the viewport during the ocean sequence.
4. GSAP maps scroll progress to camera and environment properties.
5. After the ocean sequence, normal Astro content continues.

Avoid unnecessary framework hydration.

Initialize the Three.js scene through an Astro
client-side script.

Use WebGL efficiently and clean up GPU resources,
animation frames, and event listeners when appropriate.

If Astro ClientRouter is already used, handle
navigation lifecycle and prevent duplicate initialization.

## Performance Requirements

- Keep the initial JavaScript bundle small.
- Lazy-load the Three.js scene where practical.
- Limit device pixel ratio.
- Reduce shader complexity on mobile.
- Provide a static fallback for WebGL failures.
- Respect prefers-reduced-motion.
- Preserve SEO and accessibility.

## Main Goal

Build a cinematic ocean descent experience
without sacrificing Astro's lightweight architecture.

Prioritize visual quality, smooth scrolling,
and minimal runtime overhead.