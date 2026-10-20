/**
 * 데이터베이스 표(테이블)를 현재 컬렉션 구조에 맞게 만듭니다.
 * `npm run db:sync` (Vercel 빌드에서는 build:vercel이 자동 실행)
 *
 * 개발 모드(NODE_ENV=development)로 Payload를 한 번 띄우면 스키마가 자동 반영됩니다.
 * 컬럼 삭제처럼 데이터가 사라지는 변경은 이 방식 대신 `npx payload migrate:create` 마이그레이션을 쓰세요.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const payload = await getPayload({ config })
payload.logger.info('DB 스키마 동기화 완료')
process.exit(0)
