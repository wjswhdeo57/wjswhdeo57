import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildSponsoredIndex, classifyLink, normalizeUrl } from '../src/lib/links/rewriteOutbound'
import { isTrusted } from '../src/lib/links/trusted'
import { selectCreative } from '../src/lib/ads/selectCreative'
import { articleJsonLd, serializeJsonLd } from '../src/lib/seo/jsonld'
import { checkQuality, similarity } from '../src/lib/content/quality'
import { headings, splitBeforeNthH2, charCount } from '../src/lib/content/lexical'
import type { AdPlacementDoc, LexicalState, PostDoc } from '../src/lib/types'

const SITE = 'https://www.example.com'

test('링크 분류: 내부·공식·일반 외부·광고주', () => {
  const idx = buildSponsoredIndex([{ code: 'abc123', destinationUrl: 'https://www.insurer.co.kr/landing/', active: true }])

  assert.deepEqual(classifyLink('/silson/guide', SITE, idx), { href: '/silson/guide', kind: 'internal' })
  assert.equal(classifyLink('https://example.com/a', SITE, idx).kind, 'internal')

  const fss = classifyLink('https://www.fss.or.kr/fss/main.do', SITE, idx)
  assert.equal(fss.kind, 'trusted')
  assert.equal(fss.rel, 'noopener')

  const news = classifyLink('https://news.example.net/article/1', SITE, idx)
  assert.equal(news.rel, 'nofollow noopener')

  // utm 파라미터, www, 끝 슬래시가 달라도 광고주 링크로 인식
  const ad = classifyLink('http://insurer.co.kr/landing?utm_source=blog', SITE, idx)
  assert.equal(ad.href, '/go/abc123')
  assert.equal(ad.rel, 'sponsored nofollow noopener')

  assert.equal(classifyLink('javascript:alert(1)', SITE, idx).href, '#')
})

test('비활성 광고 링크는 색인에서 빠짐', () => {
  const idx = buildSponsoredIndex([{ code: 'off', destinationUrl: 'https://x.com/a', active: false }])
  assert.equal(idx.size, 0)
})

test('공식 출처 판별', () => {
  assert.ok(isTrusted('www.fsc.go.kr'))
  assert.ok(isTrusted('knia.or.kr'))
  assert.ok(isTrusted('www.law.go.kr'))
  assert.ok(!isTrusted('blog.naver.com'))
  assert.ok(!isTrusted('fakego.kr'))
  assert.equal(normalizeUrl('https://WWW.A.com/x/?utm_medium=b&q=1'), 'a.com/x?q=1')
})

const now = new Date('2026-10-20T00:00:00Z')
const campaign = (o: object = {}) => ({ id: 'c1', name: 'c', status: 'active' as const, priority: 0, ...o })
const imgCreative = (id: string, camp = campaign()) => ({
  id, name: id, type: 'image' as const, campaign: camp,
  image: { id: 'm', url: '/a.png', alt: 'a' }, link: { id: 'l', code: 'x', destinationUrl: 'https://a.com', kind: 'sponsored' as const },
})
const place = (creative: object, o: object = {}): AdPlacementDoc => ({ id: Math.random(), slot: 's', creative: creative as never, weight: 1, active: true, ...o })

test('광고 선택: 기간·상태·카테고리·우선순위·가중치', () => {
  const a = imgCreative('A')
  const b = imgCreative('B', campaign({ status: 'paused' }))
  const c = imgCreative('C', campaign({ endAt: '2026-01-01' }))
  const d = imgCreative('D', campaign({ targetCategories: [7] }))
  const e = imgCreative('E', campaign({ priority: 5 }))

  assert.equal(selectCreative([place(a), place(b), place(c)], { now })?.id, 'A')
  assert.equal(selectCreative([place(d)], { now, categoryId: 3 }), null)
  assert.equal(selectCreative([place(d)], { now, categoryId: 7 })?.id, 'D')
  assert.equal(selectCreative([place(a), place(e)], { now })?.id, 'E', '우선순위 높은 캠페인이 이김')
  assert.equal(selectCreative([place(a, { endAt: '2026-10-01' })], { now }), null, '배치 기간 종료')

  const pa = place(imgCreative('W1'), { weight: 1 })
  const pb = place(imgCreative('W3'), { weight: 3 })
  assert.equal(selectCreative([pa, pb], { now, random: () => 0.1 })?.id, 'W1')
  assert.equal(selectCreative([pa, pb], { now, random: () => 0.5 })?.id, 'W3')
})

test('이미지 소재는 이미지·링크가 없으면 게재 불가', () => {
  const broken = { ...imgCreative('X'), link: null }
  assert.equal(selectCreative([place(broken)], { now }), null)
})

const heading = (text: string, tag = 'h2') => ({ type: 'heading', tag, children: [{ type: 'text', text }] })
const para = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', text }] })
const body = (...children: object[]): LexicalState => ({ root: { type: 'root', children: children as never } })

test('본문 분할: 두 번째 H2 앞에서 자르고, H2가 부족하면 null', () => {
  const s = body(para('도입'), heading('하나'), para('a'), heading('둘'), para('b'))
  const split = splitBeforeNthH2(s, 2)
  assert.ok(split)
  assert.equal(split![0].root.children.length, 3)
  assert.equal(split![1].root.children[0].tag, 'h2')
  assert.equal(splitBeforeNthH2(body(heading('하나')), 2), null)
})

test('목차 id 중복 처리', () => {
  const t = headings(body(heading('보장 범위'), heading('보장 범위'), heading('예외', 'h3')))
  assert.deepEqual(t.map((x) => x.id), ['보장-범위', '보장-범위-2', '예외'])
})

test('JSON-LD: Article + WebPage + BreadcrumbList, 스크립트 삽입 차단', () => {
  const post: PostDoc = {
    id: 1, title: '실손보험 4세대 전환</script>', slug: 'silson-4th', status: 'published',
    category: { id: 2, name: '실손보험', slug: 'silson' },
    author: { id: 3, name: '김작가', slug: 'kim', role: 'author', credentials: [{ name: '손해사정사' }] },
    reviewer: { id: 4, name: '이감수', slug: 'lee', role: 'reviewer' },
    createdAt: '2026-10-01', updatedAt: '2026-10-20', publishedAt: '2026-10-02', reviewedAt: '2026-10-19',
    sources: [{ title: '금감원 보도자료', url: 'https://www.fss.or.kr/x' }],
  }
  const ld = articleJsonLd(post) as { '@graph': Record<string, unknown>[] }
  const types = ld['@graph'].map((g) => g['@type'])
  assert.deepEqual(types, ['Article', 'WebPage', 'BreadcrumbList'])
  const article = ld['@graph'][0] as { author: { hasCredential: unknown[] }; mainEntityOfPage: { '@id': string } }
  assert.equal(article.author.hasCredential.length, 1)
  assert.ok(article.mainEntityOfPage['@id'].endsWith('/silson/silson-4th'))
  assert.equal((ld['@graph'][1] as { reviewedBy: { name: string } }).reviewedBy.name, '이감수')
  const s = serializeJsonLd(ld)
  assert.ok(!s.includes('</script>'))
  JSON.parse(s) // 여전히 유효한 JSON
})

test('품질 게이트: 출처 부족·중복은 차단, 분량·광고성 표현은 경고', () => {
  const short = body(heading('하나'), para('무조건 가입하세요'))
  const r = checkQuality({
    title: '실손보험 청구 방법 총정리',
    body: short,
    bodyText: '무조건 가입하세요',
    sources: [{ title: '블로그', url: 'https://blog.naver.com/x' }],
    existingTitles: ['실손보험 청구 방법 총정리 2026'],
    registeredDestinations: new Set(),
    normalize: normalizeUrl,
  })
  assert.equal(r.blocking.length, 2)
  assert.ok(r.warnings.some((w) => w.includes('무조건')))
  assert.ok(r.warnings.some((w) => w.includes('H2')))

  const longText = '가'.repeat(2100)
  const good = body(heading('a'), para(longText), heading('b'), { type: 'list', children: [] }, heading('c'))
  const ok = checkQuality({
    title: '자동차보험 특약 정리',
    body: good,
    bodyText: longText,
    sources: [{ title: 'a', url: 'https://www.fss.or.kr/a' }, { title: 'b', url: 'https://www.knia.or.kr/b' }],
    existingTitles: ['암보험 진단비 비교'],
    registeredDestinations: new Set(),
    normalize: normalizeUrl,
  })
  assert.deepEqual(ok, { blocking: [], warnings: [] })
  assert.ok(charCount(good) >= 2000)
  assert.ok(similarity('가나다라', '가나다라') === 1)
})
