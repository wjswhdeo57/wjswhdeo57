# 보험 정보 블로그 (Next.js + Payload CMS)

보험 정보 콘텐츠를 AI로 생성·검수·발행하고, 애드센스와 직접 배너 광고로 수익을 내는 웹사이트입니다.

- **화면·SEO**: Next.js 15 (App Router, 정적 생성 + ISR)
- **관리자 화면·DB**: Payload CMS 3 (`/admin`), PostgreSQL (로컬 테스트는 SQLite 자동)
- **배포**: Vercel Pro + Neon(PostgreSQL) + Vercel Blob(이미지) 권장

> Vercel 무료(Hobby) 플랜은 애드센스 등 광고가 있는 사이트를 상업적 용도로 보고 금지합니다. 광고를 붙이기 전에 Pro로 바꾸세요.

---

## 1. 처음 배포하기 (코딩 없이 따라 하기)

컴퓨터에 프로그램을 설치할 필요 없이, 웹 브라우저만으로 진행합니다. 설치와 빌드는 Vercel 서버가 대신 합니다.

### ① GitHub에 코드 올리기
1. https://github.com 가입 → 오른쪽 위 **+ → New repository**
2. 이름 `insurance-blog`, **Private** 선택 → Create
3. 화면의 **uploading an existing file** 링크 클릭 → 이 폴더 안의 파일·폴더를 **전부 끌어다 놓기** → Commit changes
   (`node_modules`, `.env` 파일은 올리지 마세요. 이 프로젝트에는 처음부터 없습니다.)

### ② 데이터베이스 만들기 (Neon, 무료로 시작)
1. https://neon.tech 가입 → **Create project** (Region: 목록에서 한국과 가장 가까운 아시아 지역 선택)
2. **Connection string**을 복사 (`postgresql://...` 로 시작) → 메모장에 보관

### ③ Vercel에 연결하기
1. https://vercel.com 가입 (GitHub 계정으로) → **Add New → Project** → `insurance-blog` 저장소 **Import**
2. **Environment Variables**에 아래 값을 넣습니다.

| 이름 | 값 |
| --- | --- |
| `DATABASE_URL` | ②에서 복사한 주소 |
| `PAYLOAD_SECRET` | 아무 긴 무작위 문자열 (32자 이상) |
| `NEXT_PUBLIC_SITE_URL` | 처음엔 `https://프로젝트명.vercel.app`, 도메인 연결 후 실제 주소 |
| `NEXT_PUBLIC_SITE_NAME` | 사이트 이름 (예: 보험정보노트) |
| `CLICK_HASH_SALT` | 아무 문자열 |
| `RUN_SEED` | `1` (첫 배포에만. 기본 카테고리·광고 자리·샘플 글 생성) |

3. **Deploy** 클릭 → 3~5분 기다리면 주소가 생깁니다.
4. 프로젝트 → **Storage → Create → Blob** → 프로젝트에 연결 (이미지 업로드용. `BLOB_READ_WRITE_TOKEN`이 자동 추가됨)
5. **Settings → Environment Variables**에서 `RUN_SEED` 삭제 → **Deployments → 맨 위 … → Redeploy**

### ④ 관리자 계정 만들기
`https://내주소/admin` 접속 → 첫 화면에서 이메일·비밀번호로 관리자 계정을 만듭니다.

### ⑤ 도메인 연결 (선택이지만 권장)
Vercel 프로젝트 → **Settings → Domains** → 구입한 도메인 입력 → 안내대로 DNS 설정 →
`NEXT_PUBLIC_SITE_URL`을 새 주소로 바꾸고 Redeploy.

---

## 2. 매일 쓰는 방법

### 글 쓰기·발행 (관리자 화면)
1. `/admin` → **글 → 새로 만들기**
2. 제목, URL 주소(영문), 카테고리, 본문, **참고 자료(공식 출처 2개 이상)** 입력
3. 사람이 내용을 확인했다면 **감수일** 입력 → 상태 **발행** → 저장
   - 저장하면 해당 페이지·카테고리·사이트맵이 즉시 갱신됩니다.
   - **품질 검사** 탭에서 자동 검사 결과를 확인할 수 있습니다.

### AI 글 자동 등록
두 가지 방법 모두 같은 품질 검사를 거쳐 **'검토 대기'** 상태로만 들어갑니다. 바로 발행되지 않습니다.

- **REST API**: 관리자 화면 → 관리자 → 내 계정 → **API Key 발급** →
  `POST https://내주소/api/posts` (헤더 `Authorization: users API-Key 발급키`, 본문 JSON에 `origin: "ai"`)
- **파일 방식** (개발 환경): `content/inbox/`에 JSON을 넣고 `npm run publish:inbox`
  (형식: `content/inbox/_example.json`)

| 자동 검사 | 기준 | 결과 |
| --- | --- | --- |
| 공식 출처 | `.go.kr`, `.or.kr` 등 2개 이상 | 미달 시 등록 거부 |
| 중복 | 기존 글 제목과 70% 이상 유사 | 등록 거부 (기존 글 갱신 권장) |
| 하루 등록 수 | `AI_DAILY_LIMIT` (기본 3편) | 초과 시 거부 |
| 분량·구조 | 공백 제외 2,000자, H2 3개, 표/목록 | 경고 |
| 광고성 표현 | '무조건', '최저가' 등 | 경고 |
| 미등록 외부 링크 | 3개 이상 | 경고 |
| 발행 | AI 글은 감수일 필수, 경고는 확인 체크 필요 | 미충족 시 발행 불가 |

### 광고 넣기·바꾸기
1. **광고주** 등록 → **광고 캠페인** (기간·노출 카테고리) 생성
2. **아웃바운드 링크**에 광고주 랜딩 주소 등록 → `/go/코드` 가 만들어짐
3. **광고 소재**: 이미지 배너(슬롯 크기에 맞춰) 또는 광고주 스크립트
4. **광고 배치**: 자리(상단·중간·사이드바·하단) + 소재 + 기간 → 저장
   - **교체는 '광고 배치'만 바꾸면 됩니다.** 코드 수정·재배포가 필요 없습니다.
5. 리포트: **광고 리포트 → 일별 노출 / 클릭 기록**

애드센스 승인 후: `NEXT_PUBLIC_ADSENSE_CLIENT`(ca-pub-…) 입력 → 각 **광고 자리**에 애드센스 광고 단위 ID 입력.
직접 광고가 없는 자리에 애드센스가 자동으로 나갑니다. `/ads.txt`는 자동 생성됩니다.

### 검색엔진 등록
| 포털 | 할 일 |
| --- | --- |
| Google Search Console | 도메인 인증 → `https://내주소/sitemap.xml` 제출 |
| 네이버 서치어드바이저 | 사이트 등록 → 인증코드를 `NEXT_PUBLIC_NAVER_VERIFICATION`에 → 사이트맵과 RSS(`/feed.xml`) 제출 |
| Daum 웹마스터도구 | 사이트 등록 → 수집 요청 |
| Bing Webmaster | Search Console에서 가져오기 |

---

## 3. 구조 요약

```
src/
├── app/(site)/               공개 사이트 (홈, 카테고리, 글, 저자, 소개·편집원칙·광고정책·개인정보·문의)
├── app/(payload)/            관리자 화면 /admin, REST API /api/*
├── app/go/[code]/            아웃바운드 리다이렉트 + 클릭 기록
├── app/api/ad-impression/    광고 노출 집계
├── app/sitemap.ts · robots.ts · feed.xml · ads.txt   자동 생성
├── collections/              DB 테이블 정의 (글·카테고리·저자·이미지·주소이동 / 광고 8종)
├── components/article/       정보 영역 (광고 코드 import 금지 — ESLint로 강제)
├── components/ads/           광고 영역 (고정 크기 슬롯, 배너, 격리 스크립트, 애드센스)
└── lib/                      SEO(JSON-LD·메타), 링크 변환, 광고 선택, 품질 검사
```

**자동으로 적용되는 것**
- 글마다 `Article` + `WebPage(reviewedBy)` + `BreadcrumbList` JSON-LD, 사이트 전체 `Organization` + `WebSite`
- 페이지당 H1 1개 (에디터에서 H1 비활성, 본문 H1은 H2로 렌더)
- 본문 외부 링크: 공식 출처 → `noopener` / 일반 → `nofollow noopener` / 등록된 광고주 → `/go/코드` + `sponsored nofollow noopener`
- 광고 자리: `<aside aria-label="광고" data-nosnippet>`, 크기 선확보로 CLS 0, 1,500자 미만 글엔 중간 광고 생략
- 발행된 글 주소 변경 시 301 리다이렉트 자동 생성

## 4. 로컬에서 실행 (선택, 개발자용)

```bash
npm install
cp .env.example .env        # DATABASE_URL을 비워두면 SQLite(local.db)로 실행
npm run seed                # 기본 데이터
npm run dev                 # http://localhost:3000, 관리자 http://localhost:3000/admin
npm test                    # 핵심 로직 단위 테스트
```

## 5. 알아둘 점
- DB 구조(컬렉션)를 바꾼 뒤 배포하면 `db:sync`가 표를 자동으로 맞춥니다. 필드 삭제처럼 데이터가 지워지는 변경은 `npx payload migrate:create`로 마이그레이션을 만드세요.
- 패키지 버전은 `^`(호환 범위)로 지정되어 있습니다. 첫 `npm install`(또는 첫 Vercel 빌드) 때 정해진 버전이 `package-lock.json`으로 고정되니, 그 파일도 저장소에 올려두면 이후 빌드가 안정적입니다.
- `소개`, `개인정보처리방침`, `문의` 페이지의 TODO 부분을 실제 운영자 정보로 바꾸세요. 운영 주체가 분명할수록 애드센스 승인과 검색 신뢰도에 유리합니다.
