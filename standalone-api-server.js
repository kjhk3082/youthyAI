const express = require('express');
const cors = require('cors');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware - CORS configuration (모든 origin 허용)
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 hours
}));
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Import district policies routes
const districtPoliciesRouter = require('./district-policies-api');
const popularPoliciesRouter = require('./popular-policies-api');

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Youth District Policies API',
      version: '1.0.0',
      description: `
# 서울시 구별 청년 정책 API

## 🎯 프론트엔드 개발자를 위한 안내

### 📌 이 API의 특별한 점
**이 API는 실제 청년센터(온통청년) API 데이터를 프론트엔드 TypeScript 인터페이스와 완벽히 일치하는 형식으로 변환하여 제공합니다.**

### 🔄 데이터 흐름
1. **실시간 데이터 수집**: 청년센터(온통청년) Open API에서 실시간 정책 데이터 수집
2. **형식 변환**: TypeScript 인터페이스 형식으로 자동 변환
3. **프론트엔드 Ready**: 별도의 가공 없이 바로 사용 가능한 JSON 반환

### 💻 프론트엔드 사용 방법

#### 1. Axios 사용 예시:
\`\`\`typescript
import axios from 'axios';
import { DistrictPolicies } from '@/types/policy';

// API 베이스 URL (로컬 개발시)
const API_BASE = 'http://localhost:3001';

// 모든 구의 정책 가져오기
const fetchAllPolicies = async () => {
  const response = await axios.get(\`\${API_BASE}/api/district-policies\`);
  const districtPolicies: DistrictPolicies = response.data.data;
  return districtPolicies;
};

// 특정 구의 정책만 가져오기
const fetchDistrictPolicies = async (districts: string[]) => {
  const response = await axios.get(\`\${API_BASE}/api/district-policies\`, {
    params: { districts: districts.join(',') }
  });
  return response.data.data;
};
\`\`\`

#### 2. Fetch API 사용 예시:
\`\`\`typescript
// 서초구와 강남구 정책만 가져오기
const policies = await fetch('http://localhost:3001/api/district-policies?districts=Seocho-gu,Gangnam-gu')
  .then(res => res.json())
  .then(data => data.data);

// 기존 mock 데이터 대체
export const districtPolicies: DistrictPolicies = policies;
\`\`\`

### ✅ CORS 설정
- **localhost:3000** (프론트엔드 기본 포트) 허용됨
- **localhost:5173, 5174** (Vite 개발 서버) 허용됨
- 모든 localhost 포트에서 접근 가능

### 📊 반환 데이터 형식
API는 다음과 같은 TypeScript 인터페이스와 100% 일치하는 데이터를 반환합니다:

\`\`\`typescript
interface Policy {
  id: number;
  title: string;
  category: '취업' | '창업' | '주거' | '교육' | '복지' | '문화/예술' | '참여권리' | '신체건강' | '정신건강' | '생활지원';
  target: string;
  deadline: string;
  description: string;
  district: string;
  isHot: boolean;
  isRecruiting: boolean;
  image: string;
  metadata?: {
    applicationUrl?: string;
    applicationMethod?: string;
    supportAmount?: string;
    contact?: string;
    documents?: string;
    lastUpdate?: string;
  };
}

interface DistrictPolicies {
  [district: string]: Policy[];
}
\`\`\`

### 🔥 실제 데이터 vs Mock 데이터
- **정상 작동시**: 청년센터 실시간 데이터 (metadata.source: "Youth Center API")
- **API 타임아웃시**: 자동 생성된 Mock 데이터 (metadata.source: "mock")
- Mock 데이터도 실제와 동일한 형식으로 제공되어 프론트엔드 코드 수정 불필요

### 📝 주의사항
1. **구 이름은 영문으로**: Gangnam-gu, Seocho-gu 형식 사용
2. **D-Day 자동 계산**: deadline 필드는 "~MM/DD" 형식으로 자동 변환
3. **만료된 정책 자동 필터링**: 이미 지난 정책은 자동으로 제외됨
      `,
      contact: {
        name: 'API Support',
        email: 'support@youthpolicy.kr'
      }
    },
    tags: [
      {
        name: 'Special Features',
        description: '특수 기능 (특수 탑10 등)'
      },
      {
        name: 'District Policies',
        description: '구별 청년정책 조회'
      },
      {
        name: 'Popular Policies',
        description: '인기 정책 TOP 10'
      },
      {
        name: 'Youth Center API',
        description: '온통청년 API 연동'
      }
    ],
    servers: [
      {
        url: '',
        description: 'Current server (relative URL)'
      },
      {
        url: `http://localhost:${PORT}`,
        description: 'Local development server'
      },
      {
        url: 'https://3001-ie8kwy33uts4uea5lzj2o-6532622b.e2b.dev',
        description: 'Sandbox server'
      }
    ],
    components: {
      schemas: {
        Policy: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: '정책 고유 ID'
            },
            title: {
              type: 'string',
              description: '정책 제목'
            },
            category: {
              type: 'string',
              enum: ['취업', '창업', '주거', '교육', '복지', '문화/예술', '참여권리', '신체건강', '정신건강', '생활지원'],
              description: '정책 카테고리'
            },
            target: {
              type: 'string',
              description: '대상 연령',
              example: '20-39세'
            },
            deadline: {
              type: 'string',
              description: '마감일',
              example: '~9/30'
            },
            description: {
              type: 'string',
              description: '정책 설명'
            },
            district: {
              type: 'string',
              description: '지역구 이름'
            },
            isHot: {
              type: 'boolean',
              description: '인기 정책 여부'
            },
            isRecruiting: {
              type: 'boolean',
              description: '모집 중 여부'
            },
            image: {
              type: 'string',
              description: '이미지 경로'
            },
            metadata: {
              type: 'object',
              properties: {
                applicationUrl: {
                  type: 'string',
                  description: '신청 URL'
                },
                applicationMethod: {
                  type: 'string',
                  description: '신청 방법'
                },
                supportAmount: {
                  type: 'string',
                  description: '지원 금액'
                },
                contact: {
                  type: 'string',
                  description: '연락처'
                },
                documents: {
                  type: 'string',
                  description: '필요 서류'
                },
                lastUpdate: {
                  type: 'string',
                  format: 'date-time',
                  description: '최종 업데이트 시간'
                }
              }
            }
          }
        },
        DistrictPoliciesResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Policy'
                }
              }
            },
            metadata: {
              type: 'object',
              properties: {
                totalPolicies: {
                  type: 'integer'
                },
                districts: {
                  type: 'array',
                  items: {
                    type: 'string'
                  }
                },
                lastUpdate: {
                  type: 'string',
                  format: 'date-time'
                },
                source: {
                  type: 'string'
                }
              }
            }
          }
        },
        PopularKeywordsResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            type: {
              type: 'string',
              enum: ['national', 'seoul', 'district']
            },
            district: {
              type: 'string',
              nullable: true
            },
            keywords: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: '인기 정챒9 TOP 10 제목 목록'
            },
            total: {
              type: 'integer'
            },
            lastUpdate: {
              type: 'string',
              format: 'date-time'
            },
            source: {
              type: 'string',
              enum: ['live', 'cached']
            }
          }
        },
        TrendingPoliciesResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            trending: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: '실시간 급상승 정챒9 목록'
            },
            period: {
              type: 'string'
            },
            lastUpdate: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    }
  },
  apis: ['./standalone-api-server.js', './district-policies-api.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Import real policy fetcher
const policyFetcher = require('./real-policy-fetcher');

// API Routes
app.use('/api', districtPoliciesRouter);
app.use('/api', popularPoliciesRouter);

/**
 * 백엔드 팀의 JPA Repository와 동일한 엔드포인트
 * YouthPolicyRepository의 메서드들을 REST API로 구현
 */

// findByPolicyNameContaining - 정책명으로 검색
app.get('/api/policies/search', async (req, res) => {
  try {
    const { keyword, page = 0, size = 10 } = req.query;
    
    const allPolicies = await policyFetcher.fetchAllPolicies({
      query: keyword || '서울',
      includeRealData: true
    });
    
    // 키워드 필터링
    const filtered = keyword 
      ? allPolicies.filter(p => p.policyName.includes(keyword))
      : allPolicies;
    
    // 페이징 처리
    const start = page * size;
    const paged = filtered.slice(start, start + size);
    
    res.json({
      content: paged,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      number: page,
      size: size,
      first: page === 0,
      last: page >= Math.ceil(filtered.length / size) - 1
    });
  } catch (error) {
    console.error('Policy search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// findByPolicyField - 정책 분야별 조회
app.get('/api/policies/field/:field', async (req, res) => {
  try {
    const { field } = req.params;
    const { page = 0, size = 10 } = req.query;
    
    const allPolicies = await policyFetcher.fetchAllPolicies();
    const filtered = policyFetcher.filterByField(allPolicies, field);
    
    // 페이징 처리
    const start = page * size;
    const paged = filtered.slice(start, start + size);
    
    res.json({
      content: paged,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      number: page,
      size: size
    });
  } catch (error) {
    console.error('Field filter error:', error);
    res.status(500).json({ error: error.message });
  }
});

// findAll - 모든 정책 조회 (JpaRepository 기본 메서드)
app.get('/api/policies', async (req, res) => {
  try {
    const { page = 0, size = 20 } = req.query;
    
    const allPolicies = await policyFetcher.fetchAllPolicies({
      includeRealData: true,
      sources: ['real', 'seoul'] // 실제 데이터 우선
    });
    
    // 페이징 처리
    const start = page * size;
    const paged = allPolicies.slice(start, start + size);
    
    res.json({
      content: paged,
      totalElements: allPolicies.length,
      totalPages: Math.ceil(allPolicies.length / size),
      number: parseInt(page),
      size: parseInt(size),
      numberOfElements: paged.length,
      empty: paged.length === 0,
      first: page == 0,
      last: page >= Math.ceil(allPolicies.length / size) - 1
    });
  } catch (error) {
    console.error('Get all policies error:', error);
    res.status(500).json({ error: error.message });
  }
});

// findById - ID로 정책 조회 (JpaRepository 기본 메서드)
app.get('/api/policies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const allPolicies = await policyFetcher.fetchAllPolicies();
    const policy = allPolicies.find(p => p.policyNo === id);
    
    if (policy) {
      // 조회수 증가 시뮬레이션
      policy.viewCount = (policy.viewCount || 0) + 1;
      res.json(policy);
    } else {
      res.status(404).json({ error: 'Policy not found' });
    }
  } catch (error) {
    console.error('Get policy by ID error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 복합 검색 (JpaSpecificationExecutor를 통한 동적 쿼리 시뮬레이션)
app.post('/api/policies/search/advanced', async (req, res) => {
  try {
    const { 
      policyField, 
      minAge, 
      maxAge, 
      employmentStatus,
      educationRequirement,
      keyword,
      page = 0,
      size = 10
    } = req.body;
    
    let policies = await policyFetcher.fetchAllPolicies();
    
    // 동적 필터링 (JpaSpecification처럼)
    if (policyField) {
      policies = policyFetcher.filterByField(policies, policyField);
    }
    
    if (minAge || maxAge) {
      const userAge = minAge || maxAge;
      policies = policyFetcher.filterByAge(policies, userAge);
    }
    
    if (employmentStatus) {
      policies = policies.filter(p => 
        p.employmentStatus && p.employmentStatus.includes(employmentStatus)
      );
    }
    
    if (educationRequirement) {
      policies = policies.filter(p => 
        p.educationRequirement && p.educationRequirement.includes(educationRequirement)
      );
    }
    
    if (keyword) {
      policies = policies.filter(p => 
        p.policyName.includes(keyword) || 
        p.policySummary.includes(keyword)
      );
    }
    
    // 페이징
    const start = page * size;
    const paged = policies.slice(start, start + size);
    
    res.json({
      content: paged,
      totalElements: policies.length,
      totalPages: Math.ceil(policies.length / size),
      number: page,
      size: size,
      searchCriteria: req.body
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 특수 탑10 - 서울 전체 조회수 기반 TOP 10 정책 제목만 반환
app.get('/api/special-top10', async (req, res) => {
  try {
    console.log('📊 특수 탑10 정책 요청');
    
    // 온통청년 API에서 전체 정책 조회
    const params = {
      openApiVlak: process.env.YOUTH_API_KEY,
      srchPolyBizSecd: '003002001', // 서울
      display: 100,
      pageIndex: 1
    };
    
    const response = await axios.get('https://www.youthcenter.go.kr/opi/youthPlcyList.do', {
      params,
      timeout: 10000
    });
    
    if (response.data && response.data.youthPolicyList) {
      const policies = response.data.youthPolicyList;
      
      // 조회수(inqCnt) 기준으로 정렬하여 상위 10개 추출
      const top10 = policies
        .filter(p => p.inqCnt) // 조회수가 있는 정책만
        .sort((a, b) => parseInt(b.inqCnt) - parseInt(a.inqCnt)) // 조회수 내림차순
        .slice(0, 10)
        .map(p => p.polyBizSjnm); // 정책 제목만 추출
      
      console.log(`✅ 특수 탑10 정책 ${top10.length}개 반환`);
      
      res.json({
        success: true,
        type: 'special-top10',
        keywords: top10,
        total: top10.length,
        lastUpdate: new Date().toISOString(),
        source: 'real-api',
        description: '서울 전체 청년정책 조회수 기반 TOP 10'
      });
    } else {
      // 폴백 데이터
      const fallbackKeywords = [
        '청년국가자격증 응시료 지원',
        '으뜸관악 청년통장',
        '10월 일어나랑 증명사진 찍어드립니다',
        '청년이사차량 지원',
        '이사비 지원사업',
        '신혼부부 및 청년 전월세 대출이자 지원사업',
        '국가 자격증 및 어학시험 응시료 지원사업',
        '공직체험 인턴십',
        '해외 인턴십 채용',
        '서울청년문화패스'
      ];
      
      res.json({
        success: true,
        type: 'special-top10',
        keywords: fallbackKeywords,
        total: 10,
        lastUpdate: new Date().toISOString(),
        source: 'fallback',
        description: '서울 전체 청년정책 조회수 기반 TOP 10'
      });
    }
  } catch (error) {
    console.error('특수 탑10 조회 오류:', error);
    
    // 에러 시 폴백 데이터 반환
    const fallbackKeywords = [
      '청년국가자격증 응시료 지원',
      '으뜸관악 청년통장',
      '10월 일어나랑 증명사진 찍어드립니다',
      '청년이사차량 지원',
      '이사비 지원사업',
      '신혼부부 및 청년 전월세 대출이자 지원사업',
      '국가 자격증 및 어학시험 응시료 지원사업',
      '공직체험 인턴십',
      '해외 인턴십 채용',
      '서울청년문화패스'
    ];
    
    res.json({
      success: true,
      type: 'special-top10',
      keywords: fallbackKeywords,
      total: 10,
      lastUpdate: new Date().toISOString(),
      source: 'fallback',
      description: '서울 전체 청년정책 조회수 기반 TOP 10'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Youth District Policies API',
    version: '1.0.0',
    documentation: `/api-docs`,
    endpoints: [
      'GET /api/district-policies',
      'GET /api/district-policies/:district',
      'GET /api/hot-policies',
      'GET /api/special-top10'
    ]
  });
});

/**
 * @swagger
 * /api/special-top10:
 *   get:
 *     summary: 특수 탑10 - 서울 전체 인기 정책
 *     description: 서울 전체 청년정책 중 조회수(inqCnt) 기반 상위 10개 정책 제목만 반환합니다
 *     tags: [Special Features]
 *     responses:
 *       200:
 *         description: 성공적으로 TOP 10 정책 제목을 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 type:
 *                   type: string
 *                   example: "special-top10"
 *                 keywords:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example:
 *                     - "청년국가자격증 응시료 지원"
 *                     - "으뜸관악 청년통장"
 *                     - "10월 일어나랑 증명사진 찍어드립니다"
 *                     - "청년이사차량 지원"
 *                     - "이사비 지원사업"
 *                     - "신혼부부 및 청년 전월세 대출이자 지원사업"
 *                     - "국가 자격증 및 어학시험 응시료 지원사업"
 *                     - "공직체험 인턴십"
 *                     - "해외 인턴십 채용"
 *                     - "서울청년문화패스"
 *                 total:
 *                   type: integer
 *                   example: 10
 *                 lastUpdate:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-09-06T12:00:00.000Z"
 *                 source:
 *                   type: string
 *                   enum: [real-api, fallback]
 *                   example: "real-api"
 *                 description:
 *                   type: string
 *                   example: "서울 전체 청년정책 조회수 기반 TOP 10"
 */

/**
 * @swagger
 * /api/district-policies:
 *   get:
 *     summary: 구별 청년 정책 목록 조회
 *     description: 서울시 구별 청년 정책을 프론트엔드 형식으로 반환합니다
 *     tags: [District Policies]
 *     parameters:
 *       - in: query
 *         name: districts
 *         schema:
 *           type: string
 *         description: 콤마로 구분된 구 이름들 (예 Gangnam-gu,Seocho-gu)
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *         description: 캐시 무시하고 새로 가져오기
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DistrictPoliciesResponse'
 *             example:
 *               data:
 *                 Gangnam-gu:
 *                   - id: 1
 *                     title: "강남구 청년창업 공간 입주 모집"
 *                     category: "창업"
 *                     target: "20-39세"
 *                     deadline: "~9/30"
 *                     description: "강남구 거주 청년 대상 창업 공간 입주 지원"
 *                     district: "강남구"
 *                     isHot: true
 *                     isRecruiting: true
 *                     image: "/img/card/card1.png"
 *               metadata:
 *                 totalPolicies: 10
 *                 districts: ["Gangnam-gu"]
 *                 lastUpdate: "2025-09-06T19:30:00.000Z"
 *                 source: "Youth Center API"
 */

/**
 * @swagger
 * /api/district-policies/{district}:
 *   get:
 *     summary: 특정 구의 청년 정책 상세 조회
 *     description: 특정 구의 청년 정책을 상세하게 조회합니다
 *     tags: [District Policies]
 *     parameters:
 *       - in: path
 *         name: district
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Gangnam-gu, Gangdong-gu, Gangbuk-gu, Gangseo-gu, Gwanak-gu, Gwangjin-gu, Guro-gu, Geumcheon-gu, Nowon-gu, Dobong-gu, Dongdaemun-gu, Dongjak-gu, Mapo-gu, Seodaemun-gu, Seocho-gu, Seongdong-gu, Seongbuk-gu, Songpa-gu, Yangcheon-gu, Yeongdeungpo-gu, Yongsan-gu, Eunpyeong-gu, Jongno-gu, Jung-gu, Jungnang-gu]
 *         description: 구 이름 (영문)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 district:
 *                   type: string
 *                 districtKo:
 *                   type: string
 *                 policies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Policy'
 *                 metadata:
 *                   type: object
 *       404:
 *         description: 구를 찾을 수 없음
 */

/**
 * @swagger
 * /api/hot-policies:
 *   get:
 *     summary: 인기 청년 정책 조회
 *     description: 현재 인기있는 청년 정책들을 조회합니다
 *     tags: [Hot Policies]
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 policies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Policy'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     totalPolicies:
 *                       type: integer
 *                     lastUpdate:
 *                       type: string
 *                       format: date-time
 *                     source:
 *                       type: string
 */

/**
 * @swagger
 * tags:
 *   - name: District Policies
 *     description: 구별 청년 정책 관련 API
 *   - name: Hot Policies
 *     description: 인기 청년 정책 관련 API
 */

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 District Policies API Server is running!`);
  console.log(`📍 API Server: http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(`   GET /api/district-policies`);
  console.log(`   GET /api/district-policies/:district`);
  console.log(`   GET /api/hot-policies`);
  console.log(`\n✨ Swagger UI is available for testing!`);
});

module.exports = app;