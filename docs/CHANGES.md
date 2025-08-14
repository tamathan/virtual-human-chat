Virtual Human Chat – Change Log

## 2025-08-13: Major Refactoring & Code Quality Improvements

### 🎯 Overview
Comprehensive refactoring to improve code quality, eliminate duplication, and establish type safety across the entire project.

### ✅ Completed Changes

#### 1. Project Structure Cleanup
- **Duplicate File Resolution**: Merged duplicate `audio-worklet.js` files
  - Removed: `public/src/lib/audio/audio-worklet.js` (incorrect location)
  - Kept: `src/lib/audio/audio-worklet.js` (upgraded to advanced version)
  - Deleted: `dist/` directory (build artifacts)

- **Directory Structure**: Eliminated inappropriate `public/src/` directory
- **File Cleanup**: Removed outdated files (`plan.json`, `firebase-debug.log`, `package-scripts.ps1`)

#### 2. Type System Unification
- **Frontend Types**: Created `src/types/index.ts` with comprehensive type definitions:
  - `TokenResponse`, `TokenVerificationResponse`, `GeminiConfig`
  - `AudioWorkletConfig`, `AudioWorkletMessage`
  - `ChatMessage`, `ChatState`, `ConnectionStatus`
  - `VirtualHumanState`, `ApiError`, `EnvironmentConfig`

- **Backend Types**: Created `bff/src/types/index.ts` for BFF-specific types:
  - `EphemeralToken`, `TokenPayload`, `TokenInfo`
  - `ApiResponse`, `ErrorResponse`, `ServerConfig`

- **Type Safety**: Updated all services to use shared type definitions:
  - `TokenService` (frontend & backend)
  - `AudioProcessor` 
  - `ChatStore`

#### 3. Enhanced Audio Worklet
Upgraded to advanced audio processing with:
- **Voice Activity Detection (VAD)**: Adaptive thresholds and speech state machine
- **Noise Reduction**: High-pass filtering and noise gate
- **Error Handling**: Comprehensive error recovery and processor reset
- **Performance Monitoring**: Buffer utilization and frame counting
- **Configuration**: Runtime parameter updates via message passing

#### 4. Code Quality & Build System
- **TypeScript**: Full type checking passes without errors
- **ESLint**: Configured with TypeScript support and proper parsing
- **Build Process**: Both frontend and BFF compile successfully
- **Import Consistency**: Standardized import patterns using type imports

#### 5. Development Experience
- **Better Tooling**: ESLint configuration supports TS/TSX files
- **Type Safety**: Eliminated `any` types where possible
- **Code Organization**: Logical separation of concerns
- **Documentation**: Updated inline documentation

### 🔧 Technical Improvements

#### Audio Processing Enhancement
```typescript
// Before: Simple energy calculation
const energy = this.computeEnergy(channelData)

// After: Advanced VAD with adaptive thresholds
const adaptiveMultiplier = Math.max(0.3, Math.min(2.0, avgEnergy * 10))
const dynamicThreshold = Math.max(this.vadThreshold, avgEnergy * adaptiveMultiplier)
```

#### Type Safety Example
```typescript
// Before: Loose typing
private static cachedGeminiConfig: any = null

// After: Strict typing
private static cachedGeminiConfig: GeminiConfig | null = null
```

### 📊 Project Statistics
- **Files Removed**: 4 duplicate/outdated files
- **Type Definitions**: 15+ interfaces standardized
- **Build Errors**: 0 (down from multiple TypeScript issues)
- **ESLint Issues**: 0 (clean codebase)

### 🚀 Deployment & E2E Test Results
- **Production URL**: https://vh-fullstack-2lriuwtgxq-an.a.run.app
- **Bundle Size**: JS 235.51KB (75.95KB gzipped), CSS 18.18KB (4.27KB gzipped)
- **Load Time**: < 3 seconds complete page load
- **Health Check**: ✅ All endpoints responding correctly
- **E2E Tests**: ✅ Frontend functionality verified via Playwright
- **Infrastructure**: ✅ Cloud Run deployment successful in asia-northeast1

---

## 2025-08-14: MVP Implementation

Summary of changes made to complete MVP wiring and improve reliability.

- Audio Worklet: Added `src/lib/audio/audio-worklet.js` and updated `audio-processor.ts` to load it via a relative URL (`new URL('./audio-worklet.js', import.meta.url)`). This enables in-browser audio capture with simple VAD and periodic status updates.
- Token API Alignment:
  - Updated `bff/server.js` `POST /api/auth/token` and `POST /api/token` responses to include `expiresAt` (ISO string) alongside `expiresIn` so the frontend can compute token expiry correctly.
  - Implemented `POST /api/auth/verify` to validate JWTs and return payload metadata (`jti`, `purpose`, `iat`, `exp`) and `connectBefore` calculated from `TOKEN_CONNECT_WINDOW_SEC`.
- Environment: Server now reads `TOKEN_CONNECT_WINDOW_SEC` (defaults to 60s) for verify calculations.

Notes and follow-ups:

- Secrets hygiene: `.env.production` and `bff/.env` currently contain real-looking `GEMINI_API_KEY`/`JWT_SECRET`. Move these to Secret Manager and rotate keys. Avoid committing secrets going forward.
- Audio worklet pathing: By using a relative URL with Vite, the worklet is bundled and works both in dev and in production builds.
- Optional: If `TokenService.verifyToken()` isn't used by the app, it can be removed from the frontend. Keeping `/api/auth/verify` is harmless and useful for diagnostics.

