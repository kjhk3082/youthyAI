/**
 * @swagger
 * /api/popular-keywords:
 *   get:
 *     tags:
 *       - Popular Policies
 *     summary: 인기 정책 TOP 10 키워드 조회
 *     description: |
 *       온통청년 API 기반 실시간 인기 정책 TOP 10을 조회합니다.
 *       조회수(inqCnt) 기준으로 정렬된 정책 제목만 반환합니다.
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [national, seoul, district]
 *           default: seoul
 *         description: 조회 범위 (전국/서울/구별)
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         description: 구 이름 (type=district일 때 필수)
 *         example: Gangnam-gu
 *     responses:
 *       200:
 *         description: 인기 정책 키워드 목록
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PopularKeywordsResponse'
 *             example:
 *               success: true
 *               type: "seoul"
 *               district: null
 *               keywords:
 *                 - "서울시 청년월세 한시 특별지원"
 *                 - "청년취업사관학교"
 *                 - "서울런(Seoul Learn)"
 *                 - "희망두배 청년통장"
 *                 - "서울 청년수당"
 *                 - "청년 마음건강 지원사업"
 *                 - "서울시 청년 전세임대주택"
 *                 - "청년창업센터 입주 지원"
 *                 - "서울청년문화패스"
 *                 - "청년 건강검진 지원"
 *               total: 10
 *               lastUpdate: "2025-09-06T12:00:00Z"
 *               source: "cached"
 * 
 * /api/trending-policies:
 *   get:
 *     tags:
 *       - Popular Policies
 *     summary: 실시간 급상승 정책 조회
 *     description: 주간 조회수 증가율 기준 급상승 정책을 조회합니다.
 *     responses:
 *       200:
 *         description: 급상승 정책 목록
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrendingPoliciesResponse'
 *             example:
 *               success: true
 *               trending:
 *                 - "청년도약계좌 (신규 출시)"
 *                 - "청년 전세대출 한도 상향"
 *                 - "K-Digital Training 하반기 모집"
 *                 - "청년창업사관학교 14기 모집"
 *                 - "서울시 청년월세 특별지원 확대"
 *               period: "weekly"
 *               lastUpdate: "2025-09-06T12:00:00Z"
 * 
 * /api/autocomplete:
 *   get:
 *     tags:
 *       - Popular Policies
 *     summary: 정책 검색 자동완성
 *     description: 검색어에 따른 정책명 자동완성 제안을 제공합니다.
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: 검색어 (최소 2글자)
 *         example: "청년"
 *     responses:
 *       200:
 *         description: 자동완성 제안 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *             example:
 *               query: "청년"
 *               suggestions:
 *                 - "청년도약계좌"
 *                 - "청년취업사관학교"
 *                 - "청년월세 지원"
 *                 - "청년창업센터"
 * 
 * /api/statistics:
 *   get:
 *     tags:
 *       - Popular Policies
 *     summary: 정책 통계 조회
 *     description: 전체 정책 통계 및 카테고리별 분포를 조회합니다.
 *     responses:
 *       200:
 *         description: 정책 통계 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalPolicies:
 *                       type: integer
 *                     activePolicies:
 *                       type: integer
 *                     totalViews:
 *                       type: integer
 *                     totalApplications:
 *                       type: integer
 *                     popularCategories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           percentage:
 *                             type: number
 */

module.exports = {};