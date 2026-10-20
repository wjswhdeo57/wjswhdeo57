/**
 * 처음 한 번 실행하는 기본 데이터: 카테고리 4개, 광고 자리 4개, 저자·감수자 예시, 샘플 광고 1개, 샘플 글 1편
 *   npm run seed
 * 이미 있는 데이터는 건너뜁니다. 샘플 글·광고는 확인용이므로 실제 운영 전에 지우세요.
 */
import path from 'path'
import { getPayload } from 'payload'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import config from '../src/payload.config'
import { DEFAULT_SLOTS } from '../src/lib/ads/slots'

// 배포 빌드에서는 RUN_SEED=1 일 때만 실행 (첫 배포 후 환경변수를 지우면 다시 실행되지 않음)
if (process.env.VERCEL && process.env.RUN_SEED !== '1') {
  console.log('RUN_SEED가 설정되지 않아 기본 데이터 생성을 건너뜁니다.')
  process.exit(0)
}

const payload = await getPayload({ config })

async function upsert(collection: string, where: Record<string, unknown>, data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const found = await payload.find({ collection: collection as never, where: where as never, limit: 1 })
  if (found.docs[0]) return found.docs[0] as unknown as { id: number | string }
  return (await payload.create({ collection: collection as never, data: data as never, ...extra })) as unknown as { id: number | string }
}

// 카테고리
const cats = [
  { name: '실손보험', slug: 'silson', order: 1, description: '실손의료보험의 세대별 차이, 자기부담금, 청구 방법을 약관 기준으로 정리합니다.' },
  { name: '자동차보험', slug: 'car', order: 2, description: '자동차보험 담보와 특약, 사고 처리와 보험료 할인·할증 제도를 설명합니다.' },
  { name: '암·질병보험', slug: 'cancer', order: 3, description: '진단비·수술비 보장 구조와 면책·감액 기간 등 약관 용어를 풀어 설명합니다.' },
  { name: '연금·저축', slug: 'pension', order: 4, description: '연금보험과 저축성 보험의 세제, 해지환급금 구조를 다룹니다.' },
]
const catIds: Record<string, number | string> = {}
for (const c of cats) catIds[c.slug] = (await upsert('categories', { slug: { equals: c.slug } }, c)).id

// 광고 자리 4개 (크기 고정)
for (const s of Object.values(DEFAULT_SLOTS)) await upsert('ad-slots', { key: { equals: s.key } }, s)

// 저자·감수자 예시
const author = await upsert('people', { slug: { equals: 'editor' } }, { name: '편집자', slug: 'editor', role: 'author', title: '보험정보 에디터', bio: '실제 운영자 소개로 바꿔주세요.' })
const reviewer = await upsert('people', { slug: { equals: 'reviewer' } }, { name: '감수자', slug: 'reviewer', role: 'reviewer', title: '자격을 적어주세요 (예: 손해사정사)', credentials: [{ name: '예시 자격' }] })

// 샘플 광고: 광고주 → 캠페인 → 아웃바운드 링크 → 소재 → 배치(top)
const adv = await upsert('advertisers', { name: { equals: '샘플 광고주' } }, { name: '샘플 광고주', businessType: 'other' })
const camp = await upsert('ad-campaigns', { name: { equals: '샘플 캠페인' } }, { name: '샘플 캠페인', advertiser: adv.id, status: 'active', pricing: 'flat', priority: 0 })
const link = await upsert('outbound-links', { code: { equals: 'sample' } }, { label: '샘플 광고 랜딩', code: 'sample', destinationUrl: 'https://example.com/landing', kind: 'sponsored', advertiser: adv.id, active: true })
const banner = await upsert(
  'media',
  { alt: { equals: '샘플 광고 배너: 광고 자리 728×90 예시' } },
  { alt: '샘플 광고 배너: 광고 자리 728×90 예시' },
  { filePath: path.resolve(process.cwd(), 'public/sample-banner-728x90.png') },
)
const creative = await upsert('ad-creatives', { name: { equals: '샘플 상단 배너' } }, { name: '샘플 상단 배너', type: 'image', campaign: camp.id, image: banner.id, altText: '샘플 광고 배너', link: link.id })
const topSlot = (await payload.find({ collection: 'ad-slots', where: { key: { equals: 'top' } }, limit: 1 })).docs[0]
await upsert('ad-placements', { creative: { equals: creative.id } }, { slot: topSlot.id, creative: creative.id, weight: 1, active: true })

// 샘플 글 (사람 작성으로 등록 → 품질 경고만 남고 발행 가능)
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const markdown = `> 이 글은 사이트 동작을 확인하기 위한 **샘플**입니다. 실제 발행 전에 지우거나 내용을 검수해 바꾸세요.

## 실손보험 청구 전에 확인할 것

실손의료보험은 실제로 낸 의료비를 약관에서 정한 범위 안에서 돌려받는 보험입니다. 가입 시기(세대)에 따라 자기부담 비율과 보장 항목이 다르므로, 먼저 내 보험증권에서 가입 시기를 확인합니다.

## 기본 서류

보험사마다 요구 서류가 조금씩 다르지만 일반적으로 다음 서류를 준비합니다.

- 보험금 청구서 (보험사 앱이나 홈페이지에서 작성)
- 진료비 계산서·영수증
- 진료비 세부내역서 (비급여 항목 확인용)
- 청구 금액이나 질병에 따라 진단서·처방전 등 추가 서류

## 청구 방법

보험사 앱, 홈페이지, 팩스, 우편으로 청구할 수 있습니다. 병원과 보험사가 연결된 전산 청구 서비스를 이용하면 서류를 직접 내지 않아도 되는 경우가 있으니, 다녀온 병원이 대상인지 확인해 보세요.

## 자주 놓치는 점

보험금 청구권에는 소멸시효가 있습니다. 오래된 진료비도 시효 안이라면 청구할 수 있으므로, 정확한 기간은 약관과 보험사 안내로 확인하세요.

이 [금융감독원 안내](https://www.fss.or.kr) 페이지와 [광고주 예시 링크](https://example.com/landing?utm_source=blog)는 링크 자동 변환을 확인하기 위한 예시입니다.
`
const body = convertMarkdownToLexical({ editorConfig, markdown })
await upsert(
  'posts',
  { slug: { equals: 'silson-claim-documents-sample' } },
  {
    title: '실손보험 청구 서류와 방법 정리 (샘플 글)',
    slug: 'silson-claim-documents-sample',
    category: catIds.silson,
    excerpt: '실손의료보험을 청구할 때 기본으로 준비하는 서류와 청구 경로를 정리했습니다. 사이트 동작 확인용 샘플 글입니다.',
    body,
    author: author.id,
    reviewer: reviewer.id,
    origin: 'human',
    status: 'published',
    reviewedAt: new Date().toISOString(),
    qualityOverride: true,
    sources: [
      { title: '금융감독원 금융소비자 정보포털 파인', publisher: '금융감독원', url: 'https://fine.fss.or.kr' },
      { title: '생명보험협회', publisher: '생명보험협회', url: 'https://www.klia.or.kr' },
      { title: '손해보험협회', publisher: '손해보험협회', url: 'https://www.knia.or.kr' },
    ],
    seo: { title: '실손보험 청구 서류와 방법 정리', description: '실손의료보험 청구 시 기본 서류(청구서, 영수증, 세부내역서)와 청구 경로, 소멸시효 확인 방법을 정리했습니다.' },
  },
)

payload.logger.info('기본 데이터 준비 완료. /admin 에서 확인하세요.')
process.exit(0)
