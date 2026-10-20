/**
 * AI가 만든 글을 '검토 대기' 상태로 등록합니다.
 *
 * 사용법
 *   1) content/inbox/ 폴더에 JSON 파일을 넣습니다 (형식은 content/inbox/_example.json 참고)
 *   2) npm run publish:inbox
 *   3) 성공한 파일은 content/done/으로 옮겨지고, 실패하면 같은 이름의 .error.txt가 생깁니다.
 *   4) 관리자 화면(/admin)에서 내용을 확인하고 '감수일'을 넣은 뒤 상태를 '발행'으로 바꿉니다.
 *
 * 품질 게이트(공식 출처 2개, 중복, 하루 등록 수 등)는 Posts 컬렉션 hook에서 검사하므로
 * REST API(/api/posts)로 올려도 똑같이 적용됩니다.
 */
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import config from '../src/payload.config'

interface InboxPost {
  title: string
  slug: string
  category: string // 카테고리 slug
  excerpt?: string
  markdown: string
  sources: { title: string; publisher?: string; url: string; accessedAt?: string }[]
  author?: string // people slug
  seoTitle?: string
  seoDescription?: string
}

const inbox = path.resolve(process.cwd(), 'content/inbox')
const done = path.resolve(process.cwd(), 'content/done')
fs.mkdirSync(done, { recursive: true })

const payload = await getPayload({ config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })

const files = fs.readdirSync(inbox).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
if (!files.length) payload.logger.info('content/inbox에 등록할 JSON 파일이 없습니다.')

for (const file of files) {
  const full = path.join(inbox, file)
  const errFile = full.replace(/\.json$/, '.error.txt')
  try {
    const input = JSON.parse(fs.readFileSync(full, 'utf-8')) as InboxPost
    for (const k of ['title', 'slug', 'category', 'markdown'] as const) {
      if (!input[k]) throw new Error(`'${k}' 값이 없습니다.`)
    }

    const cat = await payload.find({ collection: 'categories', where: { slug: { equals: input.category } }, limit: 1 })
    if (!cat.docs[0]) throw new Error(`카테고리 '${input.category}'가 없습니다. 관리자 화면에서 먼저 만드세요.`)

    let authorId: number | string | undefined
    if (input.author) {
      const a = await payload.find({ collection: 'people', where: { slug: { equals: input.author } }, limit: 1 })
      authorId = a.docs[0]?.id
    }

    // 본문에 '# 제목'(H1)이 있으면 지웁니다. 페이지 제목이 유일한 H1입니다.
    const markdown = input.markdown.replace(/^#\s+.+\n+/m, '')
    const body = convertMarkdownToLexical({ editorConfig, markdown })

    const created = await payload.create({
      collection: 'posts',
      data: {
        title: input.title,
        slug: input.slug,
        category: cat.docs[0].id,
        excerpt: input.excerpt,
        body,
        sources: input.sources ?? [],
        author: authorId,
        origin: 'ai',
        status: 'review',
        seo: { title: input.seoTitle, description: input.seoDescription },
      } as never,
    })

    fs.renameSync(full, path.join(done, file))
    if (fs.existsSync(errFile)) fs.unlinkSync(errFile)
    const report = (created as unknown as { qualityReport?: string }).qualityReport
    payload.logger.info(`등록 완료 (검토 대기): ${input.title}\n  품질 검사: ${report ?? '-'}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    fs.writeFileSync(errFile, msg, 'utf-8')
    payload.logger.error(`등록 실패: ${file}\n  ${msg}`)
  }
}

process.exit(0)
