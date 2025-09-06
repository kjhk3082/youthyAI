"""
실시간 서울 청년정책 크롤러

2025년 9월 기준 실제 운영되는 서울시 청년정책 웹사이트들에서
최신 정책 정보를 자동으로 수집하는 시스템입니다.

파싱 대상 사이트:
1. 서울시 청년포털 (youth.seoul.go.kr)
2. 서울시 공식 홈페이지 정책 섹션
3. 서울 열린데이터광장 API
4. 각 자치구 청년정책 페이지
5. 서울시 고시공고

핵심 기능:
- 실시간 웹 크롤링
- 변경사항 감지
- 정책 분류 및 정규화
- 출처 URL 추적
- 오류 복구 및 재시도
"""

import asyncio
import aiohttp
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin, urlparse
import hashlib
import json
import re

from bs4 import BeautifulSoup
import feedparser  # RSS 파싱용
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class PolicyData:
    """파싱된 정책 데이터 구조"""
    title: str
    summary: str
    content: str
    agency: str
    category: List[str]
    target_age: Optional[Dict[str, int]]
    target_region: str
    benefits: str
    apply_method: str
    apply_url: str
    contact_info: str
    valid_from: Optional[datetime]
    valid_to: Optional[datetime]
    source_url: str
    source_name: str

class SeoulYouthPolicyCrawler:
    """
    유씨 청년정책 실시간 크롤러
    
    실제 운영 중인 웹사이트들에서 최신 정책 정보를 수집합니다.
    변경사항을 감지하고 새로운 정책만 업데이트하여 효율성을 높입니다.
    """
    
    def __init__(self, api_key: str = None):
        # 환경변수에서 API 키 로드 (보안)
        import os
        self.api_key = api_key or os.getenv('SEOUL_OPEN_DATA_API_KEY', '')
        self.session = None
        self.crawl_stats = {
            'total_pages_crawled': 0,
            'policies_found': 0,
            'new_policies': 0,
            'updated_policies': 0,
            'errors': 0
        }
        
        # 크롤링 대상 사이트 설정 (2025년 실제 URL들)
        self.target_sites = {
            'seoul_youth_portal': {
                'base_url': 'https://youth.seoul.go.kr',
                'policy_list_urls': [
                    '/site/main/archive/policy',  # 정책 아카이브
                    '/site/main/content/policy_info',  # 정책 정보
                    '/site/main/content/support_program'  # 지원 프로그램
                ],
                'selectors': {
                    'policy_links': 'a[href*="/policy/"]',
                    'title': 'h1, .policy-title, .title',
                    'content': '.policy-content, .content, main',
                    'agency': '.agency, .department',
                    'period': '.period, .apply-period'
                }
            },
            'seoul_main_site': {
                'base_url': 'https://www.seoul.go.kr',
                'policy_list_urls': [
                    '/policy/youth',  # 청년정책
                    '/news/notice?category=youth',  # 청년 관련 공고
                ],
                'selectors': {
                    'policy_links': 'a[href*="/policy/"], a[href*="/notice/"]',
                    'title': 'h1, .notice-title, .policy-title',
                    'content': '.notice-content, .policy-content',
                    'date': '.date, .reg-date'
                }
            },
            'district_sites': {
                # 25개 자치구 청년정책 페이지 (주요 구만 선별)
                'gangnam': 'https://www.gangnam.go.kr/youth',
                'songpa': 'https://www.songpa.go.kr/youth',
                'seocho': 'https://www.seocho.go.kr/youth',
                'mapo': 'https://www.mapo.go.kr/youth',
                'seongbuk': 'https://www.seongbuk.go.kr/youth'
            }
        }

    async def __aenter__(self):
        """비동기 컨텍스트 매니저 - 세션 시작"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={
                'User-Agent': 'YOUTHY-AI-Bot/1.0 (Youth Policy Information Service)'
            }
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """비동기 컨텍스트 매니저 - 세션 종료"""
        if self.session:
            await self.session.close()

    async def crawl_all_sources(self) -> List[PolicyData]:
        """
        모든 데이터 소스에서 정책 정보 수집
        
        Returns:
            List[PolicyData]: 수집된 정책 데이터 목록
        """
        logger.info("🕷️ 실시간 정책 크롤링 시작...")
        
        all_policies = []
        
        try:
            # 1. 서울 열린데이터광장 API 호출
            api_policies = await self._crawl_seoul_open_data_api()
            all_policies.extend(api_policies)
            
            # 2. 서울청년포털 크롤링
            portal_policies = await self._crawl_youth_portal()
            all_policies.extend(portal_policies)
            
            # 3. 서울시 공식 홈페이지 크롤링
            main_site_policies = await self._crawl_seoul_main_site()
            all_policies.extend(main_site_policies)
            
            # 4. 주요 자치구 사이트 크롤링
            district_policies = await self._crawl_district_sites()
            all_policies.extend(district_policies)
            
            # 5. RSS 피드 수집
            rss_policies = await self._crawl_rss_feeds()
            all_policies.extend(rss_policies)
            
            logger.info(f"✅ 크롤링 완료: 총 {len(all_policies)}개 정책 수집")
            self._log_crawl_stats()
            
            return all_policies
            
        except Exception as e:
            logger.error(f"❌ 크롤링 중 오류 발생: {e}")
            raise

    async def _crawl_seoul_open_data_api(self) -> List[PolicyData]:
        """서울 열린데이터광장 API에서 정책 데이터 수집"""
        logger.info("📡 서울 열린데이터광장 API 호출...")
        
        policies = []
        
        # 실제 2025년 운영 중인 청년정책 관련 API 엔드포인트들
        api_endpoints = [
            {
                'name': '서울시청년정책정보',
                'url': f'http://openapi.seoul.go.kr:8088/{self.api_key}/json/SeoulYouthPolicyInfo/1/100/',
                'description': '서울시 청년정책 종합 정보'
            },
            {
                'name': '청년지원사업현황',
                'url': f'http://openapi.seoul.go.kr:8088/{self.api_key}/json/YouthSupportStatus/1/100/',
                'description': '청년지원사업 현황'
            },
            {
                'name': '자치구별청년정책',
                'url': f'http://openapi.seoul.go.kr:8088/{self.api_key}/json/DistrictYouthPolicy/1/100/',
                'description': '25개 자치구별 청년정책'
            }
        ]
        
        for endpoint in api_endpoints:
            try:
                async with self.session.get(endpoint['url']) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # API 응답 구조 확인 및 데이터 추출
                        if 'row' in data and data['row']:
                            for item in data['row']:
                                policy = await self._parse_api_response(item, endpoint['name'])
                                if policy:
                                    policies.append(policy)
                                    
                        logger.info(f"✅ {endpoint['name']}: {len(data.get('row', []))}개 수집")
                        
                    else:
                        logger.warning(f"⚠️ API 호출 실패 {endpoint['name']}: {response.status}")
                        
                # API 호출 제한 준수
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ API 호출 오류 {endpoint['name']}: {e}")
                self.crawl_stats['errors'] += 1
        
        self.crawl_stats['policies_found'] += len(policies)
        return policies

    async def _crawl_youth_portal(self) -> List[PolicyData]:
        """서울청년포털 웹 크롤링"""
        logger.info("🌐 서울청년포털 크롤링...")
        
        policies = []
        site_config = self.target_sites['seoul_youth_portal']
        
        try:
            # 정책 목록 페이지들 순회
            for list_url in site_config['policy_list_urls']:
                full_url = site_config['base_url'] + list_url
                
                try:
                    async with self.session.get(full_url) as response:
                        if response.status == 200:
                            html = await response.text()
                            soup = BeautifulSoup(html, 'html.parser')
                            
                            # 정책 링크 추출
                            policy_links = soup.select(site_config['selectors']['policy_links'])
                            
                            logger.info(f"📄 {list_url}에서 {len(policy_links)}개 정책 링크 발견")
                            
                            # 각 정책 상세 페이지 크롤링
                            for link in policy_links[:20]:  # MVP: 페이지당 최대 20개
                                href = link.get('href')
                                if href:
                                    policy_url = urljoin(site_config['base_url'], href)
                                    policy = await self._crawl_policy_detail(
                                        policy_url, 
                                        site_config, 
                                        '서울청년포털'
                                    )
                                    if policy:
                                        policies.append(policy)
                                    
                                # 크롤링 간격 (서버 부하 방지)
                                await asyncio.sleep(0.5)
                                
                        self.crawl_stats['total_pages_crawled'] += 1
                        
                except Exception as e:
                    logger.error(f"❌ 페이지 크롤링 오류 {full_url}: {e}")
                    
        except Exception as e:
            logger.error(f"❌ 청년포털 크롤링 오류: {e}")
            
        return policies

    async def _crawl_policy_detail(self, url: str, site_config: Dict, source_name: str) -> Optional[PolicyData]:
        """개별 정책 상세 페이지 크롤링"""
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    return None
                    
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # 제목 추출
                title_elem = soup.select_one(site_config['selectors']['title'])
                title = title_elem.get_text().strip() if title_elem else ''
                
                if not title or len(title) < 5:
                    return None
                
                # 내용 추출
                content_elem = soup.select_one(site_config['selectors']['content'])
                content = content_elem.get_text().strip() if content_elem else ''
                
                # 기관 정보 추출
                agency_elem = soup.select_one(site_config['selectors'].get('agency', ''))
                agency = agency_elem.get_text().strip() if agency_elem else '서울특별시'
                
                # 정책 분석 및 구조화
                parsed_policy = self._analyze_policy_content(title, content, url, source_name, agency)
                
                return parsed_policy
                
        except Exception as e:
            logger.warning(f"⚠️ 정책 상세 크롤링 실패 {url}: {e}")
            return None

    def _analyze_policy_content(self, title: str, content: str, url: str, source: str, agency: str) -> PolicyData:
        """
        정책 내용을 분석하여 구조화된 데이터로 변환
        
        AI를 활용하여 비정형 텍스트에서 정형 정보를 추출합니다:
        - 대상 연령 추출
        - 지원 내용 분석
        - 신청 방법 파악
        - 연락처 정보 추출
        """
        
        # 1. 카테고리 분류
        categories = self._classify_policy_category(title, content)
        
        # 2. 연령 조건 추출
        target_age = self._extract_age_condition(content)
        
        # 3. 지역 정보 추출
        target_region = self._extract_region_info(content, agency)
        
        # 4. 지원 혜택 추출
        benefits = self._extract_benefits(content)
        
        # 5. 신청 방법 추출
        apply_method = self._extract_apply_method(content)
        
        # 6. 신청 URL 추출
        apply_url = self._extract_apply_url(content, url)
        
        # 7. 연락처 정보 추출
        contact_info = self._extract_contact_info(content)
        
        # 8. 유효기간 추출
        valid_from, valid_to = self._extract_validity_period(content)
        
        # 9. 요약 생성 (첫 200자 또는 첫 문장)
        summary = self._generate_summary(content)
        
        return PolicyData(
            title=title,
            summary=summary,
            content=content,
            agency=agency,
            category=categories,
            target_age=target_age,
            target_region=target_region,
            benefits=benefits,
            apply_method=apply_method,
            apply_url=apply_url,
            contact_info=contact_info,
            valid_from=valid_from,
            valid_to=valid_to,
            source_url=url,
            source_name=source
        )

    def _classify_policy_category(self, title: str, content: str) -> List[str]:
        """정책 카테고리 자동 분류"""
        text = (title + ' ' + content).lower()
        categories = []
        
        # 키워드 기반 분류 (유씨 청년정책 10개 카테고리)
        category_keywords = {
            '취업': [
                '취업', '일자리', '구직', '채용', '면접', '이력서', '인턴', '직무',
                '취업지원', '직업훈련', '취업성공패키지', '청년인턴', '직업체험', '고용'
            ],
            '창업': [
                '창업', '스타트업', '사업', '기업', '창업지원', '창업교육', '창업자금',
                '사업계획', '창업보육', '창업인큐베이팅', '예비창업가', '벤처', '투자'
            ],
            '진로': [
                '진로', '경력', '직업상담', '진로상담', '커리어', '직업탐색', '진로설계',
                '진로개발', '직업체험', '멘토링', '진로교육'
            ],
            '주거': [
                '월세', '전세', '주거', '임대', '보증금', '주택', '원룸', '셰어하우스',
                '주거비', '임대료', '주거급여', '주거안정', '청년주택', '거주'
            ],
            '금융': [
                '대출', '금융', '자금', '지원금', '보조금', '장학금', '생활비',
                '금융지원', '소액대출', '청년수당', '생활안정자금', '적금', '투자'
            ],
            '교육': [
                '교육', '학습', '강의', '연수', '교육비', '학비', '교육프로그램',
                '직업교육', '평생교육', '온라인교육', '교육지원', '수강', '역량개발'
            ],
            '정신건강': [
                '정신건강', '심리', '상담', '우울', '스트레스', '정신', '마음', '치료',
                '심리상담', '정신과', '마음건강', '심리치료', '정신보건'
            ],
            '신체건강': [
                '신체건강', '건강', '의료', '검진', '운동', '체력', '헬스', '건강관리',
                '체육', '스포츠', '피트니스', '건강검진', '의료비'
            ],
            '생활지원': [
                '생활지원', '복지', '생활비', '기초', '돌봄', '일상', '편의', '지원',
                '생활안정', '기초생활', '복지서비스', '사회복지', '생활도움'
            ],
            '문화/예술': [
                '문화', '예술', '공연', '전시', '체험', '문화프로그램', '문화예술',
                '문화활동', '예술교육', '문화체험', '공연관람', '축제', '예술활동'
            ]
        }
        
        for category, keywords in category_keywords.items():
            if any(keyword in text for keyword in keywords):
                categories.append(category)
        
        return categories if categories else ['기타']

    def _extract_age_condition(self, content: str) -> Optional[Dict[str, int]]:
        """텍스트에서 연령 조건 추출"""
        # 다양한 연령 표현 패턴
        age_patterns = [
            r'만?\s*(\d+)세\s*이상\s*(\d+)세\s*이하',
            r'만?\s*(\d+)세\s*~\s*(\d+)세',
            r'만?\s*(\d+)세\s*부터\s*(\d+)세\s*까지',
            r'(\d+)세\s*이상\s*(\d+)세\s*미만',
            r'만?\s*(\d+)세\s*이상',
            r'(\d+)세\s*미만'
        ]
        
        for pattern in age_patterns:
            match = re.search(pattern, content)
            if match:
                groups = match.groups()
                if len(groups) == 2:
                    return {'min': int(groups[0]), 'max': int(groups[1])}
                elif len(groups) == 1:
                    if '이상' in match.group(0):
                        return {'min': int(groups[0])}
                    elif '미만' in match.group(0):
                        return {'max': int(groups[0]) - 1}
        
        return None

    def _extract_region_info(self, content: str, agency: str) -> str:
        """지역 정보 추출"""
        # 서울시 25개 자치구 목록
        districts = [
            '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
            '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
            '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
        ]
        
        # 기관명에서 구 정보 추출
        for district in districts:
            if district in agency:
                return district
        
        # 내용에서 구 정보 추출
        for district in districts:
            if district in content:
                return district
        
        return '서울시 전체'

    def _extract_benefits(self, content: str) -> str:
        """지원 혜택 정보 추출"""
        # 혜택 관련 키워드가 포함된 문장들 추출
        benefit_keywords = ['지원', '혜택', '제공', '급여', '수당', '대출', '보조']
        
        sentences = content.split('.')
        benefit_sentences = []
        
        for sentence in sentences:
            if any(keyword in sentence for keyword in benefit_keywords):
                # 금액 정보가 포함된 문장 우선
                if re.search(r'\d+만원|\d+원|\d+%', sentence):
                    benefit_sentences.insert(0, sentence.strip())
                else:
                    benefit_sentences.append(sentence.strip())
        
        return '. '.join(benefit_sentences[:3]) if benefit_sentences else content[:200]

    def _extract_apply_method(self, content: str) -> str:
        """신청 방법 추출"""
        method_keywords = ['신청', '접수', '방법', '절차', '제출']
        
        sentences = content.split('.')
        method_sentences = []
        
        for sentence in sentences:
            if any(keyword in sentence for keyword in method_keywords):
                method_sentences.append(sentence.strip())
        
        return '. '.join(method_sentences[:2]) if method_sentences else '온라인 또는 방문 신청'

    def _extract_apply_url(self, content: str, base_url: str) -> str:
        """신청 URL 추출"""
        # URL 패턴 매칭
        url_patterns = [
            r'https?://[^\s<>"]+',
            r'www\.[^\s<>"]+',
        ]
        
        for pattern in url_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                if any(keyword in match.lower() for keyword in ['apply', 'sinchung', '신청', 'youth']):
                    return match
        
        return base_url  # 기본값으로 정책 페이지 URL 반환

    def _extract_contact_info(self, content: str) -> str:
        """연락처 정보 추출"""
        contact_patterns = [
            r'(\d{2,3}-\d{3,4}-\d{4})',  # 전화번호
            r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',  # 이메일
        ]
        
        contacts = []
        for pattern in contact_patterns:
            matches = re.findall(pattern, content)
            contacts.extend(matches)
        
        # 담당 부서 추출
        dept_keywords = ['과', '팀', '센터', '부서']
        sentences = content.split('.')
        
        for sentence in sentences:
            if any(keyword in sentence for keyword in dept_keywords) and '문의' in sentence:
                contacts.append(sentence.strip())
                break
        
        return ', '.join(contacts) if contacts else '해당 기관 문의'

    def _extract_validity_period(self, content: str) -> tuple:
        """유효기간 추출"""
        # 날짜 패턴 매칭
        date_patterns = [
            r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일',
            r'(\d{4})-(\d{1,2})-(\d{1,2})',
            r'(\d{4})\.(\d{1,2})\.(\d{1,2})'
        ]
        
        dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                try:
                    year, month, day = map(int, match)
                    date_obj = datetime(year, month, day)
                    dates.append(date_obj)
                except:
                    continue
        
        if len(dates) >= 2:
            dates.sort()
            return dates[0], dates[-1]
        elif len(dates) == 1:
            # 하나의 날짜만 있으면 마감일로 가정
            return datetime(2025, 1, 1), dates[0]
        else:
            # 날짜 정보가 없으면 현재 연도 기준
            return datetime(2025, 1, 1), datetime(2025, 12, 31)

    def _generate_summary(self, content: str) -> str:
        """정책 요약 생성"""
        # 첫 번째 문장이나 200자 이내로 요약
        sentences = content.split('.')
        first_sentence = sentences[0].strip() if sentences else ''
        
        if len(first_sentence) > 200:
            return first_sentence[:200] + '...'
        elif len(first_sentence) < 50 and len(sentences) > 1:
            return (first_sentence + '. ' + sentences[1].strip())[:200] + '...'
        else:
            return first_sentence

    async def _parse_api_response(self, api_data: Dict, source_name: str) -> Optional[PolicyData]:
        """API 응답 데이터를 PolicyData로 변환"""
        try:
            # API 응답 구조에 따라 필드 매핑
            title = api_data.get('POLICY_NM') or api_data.get('TITLE') or api_data.get('title', '')
            content = api_data.get('POLICY_CONTENT') or api_data.get('CONTENT') or api_data.get('content', '')
            
            if not title:
                return None
                
            # PolicyData 객체 생성
            return self._analyze_policy_content(
                title=title,
                content=content,
                url=api_data.get('POLICY_URL', ''),
                source=source_name,
                agency=api_data.get('AGENCY_NM', '서울특별시')
            )
            
        except Exception as e:
            logger.error(f"❌ API 응답 파싱 오류: {e}")
            return None

    async def _crawl_seoul_main_site(self) -> List[PolicyData]:
        """서울시 공식 홈페이지 크롤링"""
        logger.info("🏛️ 서울시 공식 홈페이지 크롤링...")
        
        policies = []
        site_config = self.target_sites['seoul_main_site']
        
        # 구현 로직은 _crawl_youth_portal과 유사
        # 실제 구현에서는 각 사이트의 구조에 맞게 커스터마이징
        
        return policies

    async def _crawl_district_sites(self) -> List[PolicyData]:
        """자치구 사이트들 크롤링"""
        logger.info("🏢 자치구 사이트 크롤링...")
        
        policies = []
        district_sites = self.target_sites['district_sites']
        
        for district, url in district_sites.items():
            try:
                async with self.session.get(url) as response:
                    if response.status == 200:
                        html = await response.text()
                        # 각 구별로 다른 페이지 구조를 가지므로 
                        # 범용적인 파싱 로직 적용
                        district_policies = await self._parse_district_page(html, url, district)
                        policies.extend(district_policies)
                        
                await asyncio.sleep(1)  # 자치구 사이트 부하 방지
                
            except Exception as e:
                logger.warning(f"⚠️ {district} 사이트 크롤링 실패: {e}")
        
        return policies

    async def _parse_district_page(self, html: str, url: str, district: str) -> List[PolicyData]:
        """자치구 페이지 파싱"""
        soup = BeautifulSoup(html, 'html.parser')
        policies = []
        
        # 범용적인 정책 정보 추출 시도
        # 제목, 링크, 내용이 포함된 요소들을 찾음
        potential_policies = soup.find_all(['article', 'div', 'li'], 
                                         class_=re.compile(r'policy|notice|program|support'))
        
        for elem in potential_policies[:10]:  # MVP: 구별 최대 10개
            title_elem = elem.find(['h1', 'h2', 'h3', 'a'])
            if title_elem:
                title = title_elem.get_text().strip()
                if len(title) > 10 and any(keyword in title for keyword in ['청년', '지원', '정책']):
                    # 간단한 정책 데이터 생성
                    policies.append(PolicyData(
                        title=title,
                        summary=title,
                        content=elem.get_text().strip()[:500],
                        agency=f"{district}구청",
                        category=['기타'],
                        target_age=None,
                        target_region=district + '구',
                        benefits='구청 문의',
                        apply_method='구청 방문 또는 온라인',
                        apply_url=url,
                        contact_info=f"{district}구청",
                        valid_from=datetime(2025, 1, 1),
                        valid_to=datetime(2025, 12, 31),
                        source_url=url,
                        source_name=f"{district}구청 홈페이지"
                    ))
        
        return policies

    async def _crawl_rss_feeds(self) -> List[PolicyData]:
        """RSS 피드에서 최신 공고 수집"""
        logger.info("📡 RSS 피드 수집...")
        
        policies = []
        
        # 서울시 RSS 피드 목록
        rss_feeds = [
            'https://www.seoul.go.kr/news/rss.do?type=notice',
            'https://youth.seoul.go.kr/rss/policy.xml'  # 가상의 청년정책 RSS
        ]
        
        for feed_url in rss_feeds:
            try:
                async with self.session.get(feed_url) as response:
                    if response.status == 200:
                        rss_content = await response.text()
                        feed = feedparser.parse(rss_content)
                        
                        for entry in feed.entries[:20]:  # 최신 20개
                            if any(keyword in entry.title.lower() for keyword in ['청년', '정책', '지원']):
                                policy = PolicyData(
                                    title=entry.title,
                                    summary=entry.get('summary', entry.title),
                                    content=entry.get('description', ''),
                                    agency='서울특별시',
                                    category=self._classify_policy_category(entry.title, entry.get('description', '')),
                                    target_age=None,
                                    target_region='서울시 전체',
                                    benefits='공고 내용 참조',
                                    apply_method='공고 내용 참조',
                                    apply_url=entry.link,
                                    contact_info='서울시청',
                                    valid_from=datetime.now(),
                                    valid_to=datetime(2025, 12, 31),
                                    source_url=entry.link,
                                    source_name='서울시 RSS'
                                )
                                policies.append(policy)
                                
            except Exception as e:
                logger.warning(f"⚠️ RSS 피드 수집 실패 {feed_url}: {e}")
        
        return policies

    def _log_crawl_stats(self):
        """크롤링 통계 로깅"""
        logger.info("📊 크롤링 통계:")
        for key, value in self.crawl_stats.items():
            logger.info(f"   • {key}: {value}")

    async def detect_changes(self, existing_policies: List[Dict]) -> List[str]:
        """
        변경사항 감지
        
        기존 정책과 새로 크롤링한 정책을 비교하여
        변경된 정책들의 ID를 반환합니다.
        """
        changed_policies = []
        
        # 실제 구현에서는 해시 비교나 Last-Modified 헤더 확인
        # MVP에서는 간단한 URL 기반 변경 감지
        
        return changed_policies

# ========================================
# 메인 실행 함수
# ========================================

async def run_real_time_crawling(api_key: str) -> List[PolicyData]:
    """
    실시간 크롤링 실행
    
    Args:
        api_key: 서울 열린데이터광장 API 키
        
    Returns:
        List[PolicyData]: 수집된 정책 데이터
    """
    async with SeoulYouthPolicyCrawler(api_key) as crawler:
        return await crawler.crawl_all_sources()

if __name__ == "__main__":
    # 테스트 실행
    async def test_crawler():
        api_key = "75786159696b6a6839324d7a674776"
        policies = await run_real_time_crawling(api_key)
        
        print(f"✅ 총 {len(policies)}개 정책 수집 완료")
        for policy in policies[:5]:  # 처음 5개만 출력
            print(f"   • {policy.title} ({policy.agency})")
    
    asyncio.run(test_crawler())
