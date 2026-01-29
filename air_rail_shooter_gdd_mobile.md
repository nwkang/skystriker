# Mobile-First Web 3D Rail Shooter — Game Design Document (GDD)
**Target:** Mobile-first (WebGL / Three.js)  
**Primary Devices:** iOS Safari, Android Chrome (portrait-first; landscape optional)  
**Audio:** WebAudio API (gesture unlock required on mobile)  
**Document Version:** v1.0-mobile (2026-01-25)  
**Purpose:** A mobile-specialized, data-driven spec optimized for implementation by a coding agent (Codex).

---

## Current Build Adjustments (2026-01-25)
- Missiles removed. Combat is primary gun + weapon powerups (dual/spread/laser/rocket) plus a new HEAL pickup.
- Game over returns to the title screen; difficulty can be changed before every start. Last score is shown on title.
- Quality selector and haptics toggle removed. Rendering is fixed to high quality with shadows on.
- Title screen includes a HOME link to the AI Game Lab page.
- Procedural BGM added via WebAudio; starts after the first user gesture.
- Visual upgrade: more detailed player jet, more varied enemy silhouettes, starfield backdrop, improved lighting.

---

## 0) Product Goals (Mobile 특화 원칙)

### Session & Feel
- **짧은 세션(1–3분)**에도 성취감: 웨이브 단위 목표를 촘촘히 제공
- **원-핸드/투-핸드 모두 가능**: 기본은 좌(이동) + 우(발사/미사일) “듀얼 엄지” UX
- **조준 스트레스 최소화**: 모바일에서는 정밀 조준이 피로하므로 **에임 어시스트(반자동 조준)**가 기본

### Performance & Battery
- 타깃 FPS: **60fps(가능 시)**, 저사양은 **30fps 안정** 우선
- 발열/배터리 고려:
  - 파티클/블룸 품질 자동 조절
  - 디바이스 성능 측정 후 품질 프리셋 적용

### Accessibility
- 버튼 크기 최소 48px(권장 56–72px)
- 색약/명도 대비 고려: 적 탄, 아군 탄, 파워업 색상 대비 확보
- 민감도/좌우 반전/진동(햅틱) on/off 제공

---

## 1) 화면 방향(Orientation) & Safe Area

### 기본 정책
- **Portrait(세로) 우선** (권장): 조이스틱/버튼 배치가 안정적이고 한 손 플레이에 유리
- Landscape(가로) 옵션: 설정에서 토글 가능(향후), 초기 MVP는 Portrait만도 가능

### Safe Area / Notch 대응
- iOS notch/홈바 영역을 피해서 UI 배치
- CSS env(safe-area-inset-*)를 고려한 패딩 적용(명세)
- HUD는 화면 가장자리에서 최소 8–16px inward

---

## 2) Controls (Mobile 전용)

### 기본 레이아웃 (Portrait)
- **왼쪽 하단:** 가상 조이스틱 (이동 X/Y)
- **오른쪽 하단:** FIRE(홀드), MISSILE(탭)
- NOTE (current build): FIRE only. Missile control removed.
- **상단:** HP/Score/Wave/Objective, Pause

### 조이스틱 규칙
- Deadzone: `0.12`
- Max radius: 화면 너비 기준 10–14% (기기별 스케일)
- 입력 스무딩(권장):
  - `move = lerp(move, targetMove, 0.25)` (프레임 기반) 또는 dt 기반 감쇠

### FIRE 버튼
- 기본: **홀드 자동사격**
- 탭 사격 모드는 옵션(초보자용)으로 제공 가능

### MISSILE 버튼
- NOTE (current build): Missile system removed. This section is deprecated.
- 탭 1회 발사(쿨다운/탄약 체크)
- 발사 전 타겟 락 UI 표시(정면 cone 내)
- 쿨다운 중에는 버튼 비활성/게이지 표시

### 선택 옵션(모바일 친화 추가)
- **Gyro(자이로) 보조 조작(옵션):** 미세 상하/좌우 조정
  - 기본 OFF, 설정에서 ON
  - Gyro는 피로도/취향 차이가 커서 필수 기능으로 두지 않음
- **Left-handed 모드:** 조이스틱과 버튼 좌우 반전

---

## 3) Aim Assist (모바일 기본 탑재)

모바일에서 정확한 조준은 피로 요소이므로 아래 중 하나를 기본으로 채택:

### 옵션 A: Soft Auto-Aim (권장)
- 크로스헤어 중심 기준 원뿔(cone) 범위 내 적이 있으면 **탄 방향을 적 중심으로 소폭 보정**
- 보정 강도: `aimAssistStrength = 0.25–0.45`
- 가까운 적 우선, 화면 중앙 우선

### 옵션 B: Auto-Target (초보자 모드)
- 가장 가까운 적을 자동 타겟팅(락)
- 대신 점수 보상(콤보/멀티플라이어)을 약간 감소(밸런스)

---

## 4) Game Flow (Mobile UX)

### State Machine
- `BOOT` → `TITLE` → `DIFFICULTY_SELECT(1–5)` → `PLAYING`
- HP 0 → `GAME_OVER` → 재시작 시 난이도 선택 화면으로 복귀
- 웨이브 3의 배수마다 `BOSS`

### Mobile UX 디테일
- Title 화면에서 **첫 탭으로 AudioContext unlock** 처리(필수)
- 짧은 튜토리얼 오버레이(최초 1회):
  - 조이스틱 이동
  - FIRE 홀드
  - MISSILE 탭
- 네트워크 없이도 플레이 가능(오디오/에셋은 사전 로딩 또는 캐시)

---

## 5) Player (Mobile Balance)

### Core Stats
- HP: `100`
- Hit invincibility: `0.6s`
- Rail bounds (portrait 기준 예시):
  - `x ∈ [-7.5, +7.5]`
  - `y ∈ [-3.0, +6.0]`
- Base move speed: `12` units/s
- “손가락 피로”를 줄이기 위해 이동이 과도하게 빠르지 않도록 유지

### Damage (Base)
- Normal bullet: `8`
- Enemy collision: `18`
- Obstacle collision: `25`
- Boss bullet: `12–16`

### Touch-friendly Feedback
- 피격 시:
  - HUD HP 깜빡임 + 짧은 카메라 흔들림
  - **햅틱(가능 시)**: `light`(iOS) / `vibrate(20ms)`(Android) 옵션

---

## 6) Weapons (Mobile)

### Primary Gun
- Auto-fire (hold)
- Fire rate: `10 rps` (cooldown `0.10s`)
- Bullet damage: `5`
- Bullet speed: `60`
- Bullet lifetime: `2.0s` (권장)

### Missile (Lock-on)
- NOTE (current build): Missile system removed. This section is deprecated.
- Cooldown: `6.0s` (난이도 스케일)
- Lock cone: half-angle `15°`
- Lock range: `80`
- Lock hysteresis: `0.25s` 안정 유지 후 락 확정(깜빡임 방지)
- Missile damage: `60`
- Guidance: turn-rate 제한
- Target lost: 1s 직진 후 자폭(또는 1회 재탐색)

---

## 7) Powerups (모바일 가독성/간단 규칙)

### 공통 규칙
- 드랍 확률 + 특정 웨이브 보장 드랍
- 지속시간 기반
- 중첩 규칙(간단):
  - 동일 타입: 남은 시간 +50% (최대 20s)
  - 다른 타입: 즉시 교체

### Types (Baseline)
- `DUAL` duration `10s`
- `SPREAD` duration `10s`
- `LASER` duration `8s`
- `ROCKET` duration `10s`, splash radius `3.5`
- `HEAL` instant +25 HP (no duration)

모바일에서는 HUD가 작아지므로:
- 파워업 아이콘은 **큰 실루엣 + 색상**으로 구분
- 남은 시간은 숫자보다 **원형 게이지**가 우선

---

## 8) Enemies & Patterns (모바일 ‘읽힘’ 우선)

### Enemy Tiers
- FIGHTER / MEDIUM / ELITE / BOSS

### Readability Rules (Mobile)
- 탄막 패턴은 화면 크기/해상도 변동에도 안전지대가 확보되어야 함
- **“탄속과 발사 빈도”를 동시에 올리지 않기** (난이도 상승 시 한 축 중심으로 조절)
- 플레이어가 한 번에 판단할 정보량 제한:
  - 동시 탄막 소스(발사자) 수 상한 권장: early 2–3, late 4–6

### Pattern Library
- `SINGLE`, `SPREAD_N`, `BURST_N`, `SINE_SWEEP`
- Boss: `RING`, `WALL_GAP`, `CROSS`

---

## 9) Waves / Boss

### Wave End Conditions
- `KILL_COUNT` / `SURVIVE_TIME` / `ELITE_KILL`

### Boss Rule
- Every 3 waves (3, 6, 9…)

### Boss Phase Design
- HP ratio thresholds로 phase 전환
- Phase가 바뀔 때:
  - 패턴 예고(0.5–1.0s)
  - SFX stinger + 화면 경고 텍스트(짧게)

---

## 10) Obstacles (모바일 UX)

### Types
- `RING` (통과 보너스 가능)
- `TOWER`
- `DRONE_OBSTACLE` (이동 장애물, 선택적으로 파괴 가능)

### Rules
- Collision damage: `25`
- 장애물은 ‘보이는 즉시 판단’ 가능하도록 대비/실루엣 강화
- 모바일에서는 시야가 좁으므로 장애물 스폰은 **미리 예고**(경미한 그림자/표시)

---

## 11) Scoring & Combo (모바일 세션 구조)

### Base Score
- FIGHTER 100 / MEDIUM 250 / ELITE 600 / BOSS 5000

### Combo (추천)
- 2.0s 내 처치 유지
- `mult = 1 + min(combo, 50) * 0.02` (max 2.0x)
- 피격 시 reset 또는 큰 감소

모바일 플레이어는 짧은 세션이 많으므로:
- **웨이브 종료 보너스(노히트/콤보 보너스)**를 명확히 표기

---

## 12) Difficulty (1–5) Scaling (Mobile-safe)

### Multipliers
- Enemy HP: `[0.8, 1.0, 1.2, 1.5, 1.9]`
- Bullet speed: `[0.9, 1.0, 1.1, 1.25, 1.4]`
- Fire rate: `[0.85, 1.0, 1.15, 1.35, 1.6]`
- Spawn density: `[0.9, 1.0, 1.15, 1.35, 1.6]`
- Player speed: `[1.05, 1.0, 1.0, 0.98, 0.95]`

### Missile Cooldown Scaling
- NOTE (current build): Missile system removed. This section is deprecated.
- `6.0s * [0.9, 1.0, 1.05, 1.15, 1.3]`

**Mobile fairness rule:** 난이도 4–5에서도 “반드시 회피 루트 존재”를 강제.

---

## 13) UI/HUD (Mobile)

### Must-have HUD (Portrait)
- HP bar (상단)
- Wave/Objective (상단 중앙 또는 좌측)
- Score + Combo (상단)
- Missile cooldown radial (우측 하단 근처)
- NOTE (current build): Missile HUD removed.
- Powerup icon + duration gauge
- Crosshair (중앙, 너무 크지 않게)

### Button & Touch Specs
- 최소 터치 영역: 48px, 권장 56–72px
- 연속 홀드(사격) 중에도 조이스틱 드래그가 방해되지 않게
  - Pointer capture 분리
- UI는 DOM overlay 또는 Canvas/Three overlay 중 택1
  - 성능/레이아웃 비용 고려 시 Canvas 기반 HUD도 고려

### Pause & Settings (Mobile)
- Pause 시:
  - BGM 볼륨 낮춤(40%) 또는 low-pass filter
- Settings:
  - SFX/BGM volume
  - Haptics on/off
  - Left-handed
  - Sensitivity
  - Quality (Auto/Low/Med/High)
- NOTE (current build): Haptics always on; no haptics/quality settings.

---

## 14) Audio (Mobile Web 특화)

### 핵심 제약
- iOS/Android는 **사용자 제스처 이후에만** 오디오 재생 가능:
  - Title/Difficulty 화면 첫 탭에서 `audioContext.resume()` 수행
- 오디오 디코딩/메모리:
  - BGM은 스트리밍(HTMLAudio) + WebAudio 혼용도 가능
  - SFX는 WebAudio buffer decode 권장 (짧고 반복됨)

### Music Plan (State-based)
- `TITLE_THEME` (loop)
- `STAGE_AMBIENT` (loop)
- `WAVE_INTENSE` (optional)
- `BOSS_THEME` (loop)
- `RESULT_THEME`

### Transition Rules
- Crossfade 1.0–1.5s
- Boss warning stinger 1–2s 후 BOSS_THEME로 crossfade

### SFX List (Minimum)
- gun fire (throttled), missile launch, lock-on, player hit, explosions, UI click
- NOTE (current build): Remove missile/lock-on SFX.

### Mixing / Ducking
- BGM 0.6, SFX 0.9 기본
- 큰 폭발/보스 히트 시 BGM 15–25% duck 0.3–0.6s

### Haptics 연동(옵션)
- NOTE (current build): Haptics always enabled (no toggle).
- 미사일 발사, 피격, 보스 경고 등에 짧은 진동
- 설정에서 끄기 가능

---

## 15) Rendering & Performance Budgets (Mobile 필수)

### Frame & Memory Budgets (권장 기준)
- Draw calls: 150 이하(초기 목표 80–120)
- Triangles: 150k 이하(초기 목표 60–120k)
- Texture memory: 128–256MB 수준 내(기기별 상이) — 압축/해상도 스케일링 필수
- Particle count: 화면 내 300–800(스프라이트 기반), 상황에 따라 제한

### Quality Presets (Auto)
- NOTE (current build): Quality selector removed; always render at high quality.
- **LOW:** bloom off, particle cap 낮춤, shadow off, renderScale 0.75
- **MED:** bloom on(약), particle 중간, shadow low, renderScale 0.9
- **HIGH:** bloom on, particle 높음, shadow on, renderScale 1.0

### Mandatory Optimizations
- **Object Pooling**: bullets/enemies/particles
- Reuse vectors/quaternions to reduce GC
- Use `InstancedMesh` for bullets/drones if needed
- Avoid expensive postprocessing on low-end

### Dynamic Resolution (권장)
- FPS 측정 후 renderScale을 자동 조절
  - <45fps 지속 시 0.9 → 0.8 단계 하향
  - 안정 시 점진 상향

---

## 16) Technical Architecture (Codex-friendly)

### World Scroll Model (Recommended)
- Player는 거의 고정
- 적/장애물/배경이 -Z 방향으로 이동

### Per-frame Update Pipeline
1. `InputSystem` (touch joystick/buttons) → `InputState`
2. `PlayerSystem` (movement + aim assist + firing)
3. `WaveDirector` (timers + spawn rules)
4. `EnemySystem` (movement + firing)
5. `ProjectileSystem` (move + lifetime)
6. `CollisionSystem` (sphere tests)
7. `DamageSystem` (invincibility)
8. `ScoreSystem` (combo/mult)
9. `CleanupSystem` (pool recycle)
10. `UISystem`
11. `AudioSystem` (event-driven)

### Event Bus (Recommended)
- Gameplay events emit:
- `PLAYER_HIT`, `ENEMY_KILLED`, `MISSILE_FIRED`, `LOCK_ACQUIRED`, `BOSS_START`, `WAVE_CLEAR` …
- NOTE (current build): Remove missile-related events.
- Audio/VFX/UI는 event를 구독하여 반응(결합도 감소)

---

## 17) Data Schemas (Examples)

### EnemyPreset
```json
{
  "id": "FIGHTER_A",
  "class": "FIGHTER",
  "hp": 20,
  "speed": 18,
  "hitRadius": 0.9,
  "scoreValue": 100,
  "movementPatternId": "ZIGZAG",
  "firePatternId": "SINGLE",
  "fireRate": 1.2,
  "bulletSpeed": 40,
  "bulletDamage": 8,
  "dropTableId": "BASIC"
}
```

### WaveConfig
```json
{
  "waveIndex": 1,
  "endCondition": { "type": "KILL_COUNT", "value": 18 },
  "spawns": [
    { "t": 0.0, "presetId": "FIGHTER_A", "count": 6, "formation": "V", "lane": "RANDOM" },
    { "t": 4.0, "presetId": "FIGHTER_A", "count": 6, "formation": "LINE", "lane": "RANDOM" },
    { "t": 8.0, "presetId": "ATTACKER_B", "count": 2, "formation": "PAIR", "lane": "CENTER" }
  ],
  "powerupGuarantee": [{ "type": "DUAL", "t": 6.0 }]
}
```

### Audio Config (Paths)
```json
{
  "bgm": {
    "TITLE_THEME": ["assets/audio/bgm/title.ogg", "assets/audio/bgm/title.mp3"],
    "STAGE_AMBIENT": ["assets/audio/bgm/stage.ogg", "assets/audio/bgm/stage.mp3"],
    "BOSS_THEME": ["assets/audio/bgm/boss.ogg", "assets/audio/bgm/boss.mp3"]
  },
  "sfx": {
    "SFX_GUN_FIRE": ["assets/audio/sfx/gun.ogg", "assets/audio/sfx/gun.mp3"],
    "SFX_MISSILE_LAUNCH": ["assets/audio/sfx/missile.ogg", "assets/audio/sfx/missile.mp3"],
    "SFX_LOCK_ON": ["assets/audio/sfx/lock.ogg", "assets/audio/sfx/lock.mp3"]
  }
}
```
- NOTE (current build): Missile/lock-on SFX entries removed; BGM is procedural (WebAudio synth).

---

## 18) Debugging Checklist (Mobile)

1. dt 적용 누락 → FPS에 따라 속도/연사 변동
2. 터치 이벤트 충돌(조이스틱 드래그 중 버튼 눌림/반대) → pointerId 분리
3. 오디오 미재생(모바일 정책) → 첫 탭에서 AudioContext resume 필요
4. 성능 저하/발열 → quality auto downscale, pool 적용
5. 노치/홈바로 버튼 가림 → safe-area inset 적용
6. 탄막이 과도 → 안전지대 규칙 강제
7. 버튼 히트박스 작음 → 최소 48px 이상

---

## Appendix A) Mobile MVP 범위(추천)
- Portrait only
- Waves 1–3 (Wave 3 boss)
- Enemies: 2 fighters + 1 medium
- Powerups: DUAL + SPREAD
- Obstacles: RING + TOWER
- Audio: Title/Stage/Boss BGM + 핵심 SFX
- Settings: Volume + Haptics + Left-handed + Quality(Auto/Low/High)
- NOTE (current build): Haptics always on; quality fixed high.
