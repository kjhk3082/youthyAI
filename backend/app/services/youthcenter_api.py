"""
온통청년 API 클라이언트

온통청년(youthcenter.go.kr)에서 제공하는 청년정책 API를 호출하여
상세한 청년정책 정보를 가져오는 서비스입니다.

API 문서: https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc
"""

import httpx
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, date
import asyncio
from urllib.parse import urlencode
import re

logger = logging.getLogger(__name__)

class YouthCenterAPIClient:
    """온통청년 API 클라이언트"""
    
    # 청년정책 8개 카테고리 정의
    POLICY_CATEGORIES = {
        "취업": ["취업", "일자리", "채용", "구직", "인턴", "구직활동"],
        "창업": ["창업", "스타트업", "사업", "기업", "벤처"],
        "주거": ["주거", "월세", "전세", "임대", "주택", "거주"],
        "교육": ["교육", "학습", "강의", "연수", "훈련", "스킬"],
        "복지": ["복지", "지원금", "수당", "급여", "생활비", "의료"],
        "문화/예술": ["문화", "예술", "공연", "전시", "축제", "체험"],
        "참여권리": ["참여", "권리", "정치", "시민", "봉사", "활동"],
        "기타": ["기타", "종합", "통합", "일반"]
    }
    
    def __init__(self, api_key: str = "2a27a665-5b2c-48dd-913e-965ea1956104"):
        """
        온통청년 API 클라이언트 초기화
        
        Args:
            api_key: 온통청년 API 키
        """
        self.api_key = api_key
        self.base_url = "https://www.youthcenter.go.kr/opi"
        self.timeout = 30.0
        
        # HTTP 클라이언트 설정 (리다이렉트 처리)
        self.client_config = {
            "follow_redirects": True,
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "application/json, text/html, */*",
                "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
                "Referer": "https://www.youthcenter.go.kr/"
            }
        }
        
    async def search_policies(
        self,
        query: str = "",
        page_index: int = 1,
        display: int = 10,
        biz_type_codes: List[str] = None,
        policy_biz_codes: List[str] = None,
        keyword: str = ""
    ) -> Dict[str, Any]:
        """
        청년정책 검색
        
        Args:
            query: 검색어
            page_index: 페이지 번호 (1부터 시작)
            display: 한 페이지당 표시할 개수 (최대 100)
            biz_type_codes: 사업유형코드 리스트 (예: ['023010', '023020'])
            policy_biz_codes: 정책분야코드 리스트 (예: ['003002001', '003002002'])
            keyword: 키워드 (예: '채용,구직,기관')
            
        Returns:
            API 응답 데이터
        """
        try:
            # 파라미터 구성
            params = {
                "openApiVlak": self.api_key,
                "pageIndex": page_index,
                "display": min(display, 100)  # 최대 100개 제한
            }
            
            if query:
                params["query"] = query
                
            if biz_type_codes:
                params["bizTycdSel"] = ",".join(biz_type_codes)
                
            if policy_biz_codes:
                params["srchPolyBizSecd"] = ",".join(policy_biz_codes)
                
            if keyword:
                params["keyword"] = keyword
            
            url = f"{self.base_url}/youthPlcyList.do"
            
            logger.info(f"온통청년 API 호출: {url}")
            logger.info(f"파라미터: {params}")
            
            async with httpx.AsyncClient(timeout=self.timeout, **self.client_config) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                
                # 응답이 JSON인지 확인
                content_type = response.headers.get('content-type', '')
                if 'application/json' in content_type:
                    data = response.json()
                else:
                    # HTML 응답인 경우 (API 키 문제 등)
                    logger.warning(f"예상치 못한 응답 타입: {content_type}")
                    logger.warning(f"응답 내용 (처음 500자): {response.text[:500]}")
                    
                    # 기본 응답 구조 반환
                    data = {"youthPolicy": []}
                
                # 만료된 정책 필터링
                if 'youthPolicy' in data and data['youthPolicy']:
                    original_count = len(data['youthPolicy'])
                    data['youthPolicy'] = self._filter_active_policies(data['youthPolicy'])
                    filtered_count = len(data['youthPolicy'])
                    
                    logger.info(f"온통청년 API 응답: 원본 {original_count}개 -> 유효 {filtered_count}개 정책")
                else:
                    logger.info("온통청년 API 응답: 정책 데이터 없음")
                
                return data
                
        except httpx.HTTPError as e:
            logger.error(f"온통청년 API HTTP 오류: {e}")
            raise Exception(f"온통청년 API 호출 실패: {str(e)}")
            
        except Exception as e:
            logger.error(f"온통청년 API 예상치 못한 오류: {e}")
            raise Exception(f"온통청년 API 처리 중 오류 발생: {str(e)}")
    
    async def get_policy_detail(self, policy_id: str) -> Dict[str, Any]:
        """
        특정 정책의 상세 정보 조회
        
        Args:
            policy_id: 정책 ID
            
        Returns:
            정책 상세 정보
        """
        try:
            # 먼저 전체 검색으로 해당 정책을 찾기
            policies_data = await self.search_policies(display=100)
            
            if "youthPolicy" not in policies_data:
                return None
                
            # 정책 ID로 찾기
            for policy in policies_data["youthPolicy"]:
                if policy.get("polyBizSecd") == policy_id or policy.get("bizId") == policy_id:
                    return policy
                    
            return None
            
        except Exception as e:
            logger.error(f"정책 상세 조회 오류: {e}")
            return None
    
    async def search_policies_by_keywords(self, keywords: List[str], max_results: int = 50) -> List[Dict[str, Any]]:
        """
        키워드 리스트로 정책 검색
        
        Args:
            keywords: 검색 키워드 리스트
            max_results: 최대 결과 개수
            
        Returns:
            정책 리스트
        """
        all_policies = []
        
        try:
            for keyword in keywords:
                logger.info(f"키워드 '{keyword}'로 정책 검색 중...")
                
                # 각 키워드로 검색
                data = await self.search_policies(
                    query=keyword,
                    display=min(20, max_results)
                )
                
                if "youthPolicy" in data:
                    policies = data["youthPolicy"]
                    # 각 키워드 검색 결과에서도 만료 정책 필터링 (이미 search_policies에서 필터링되지만 추가 보장)
                    active_policies = self._filter_active_policies(policies)
                    all_policies.extend(active_policies)
                    
                # API 호출 제한을 위한 짧은 대기
                await asyncio.sleep(0.5)
            
            # 중복 제거 (정책 ID 기준)
            seen_ids = set()
            unique_policies = []
            
            for policy in all_policies:
                policy_id = policy.get("bizId") or policy.get("polyBizSecd")
                if policy_id and policy_id not in seen_ids:
                    seen_ids.add(policy_id)
                    unique_policies.append(policy)
                    
                if len(unique_policies) >= max_results:
                    break
            
            logger.info(f"총 {len(unique_policies)}개의 고유 정책 발견")
            return unique_policies
            
        except Exception as e:
            logger.error(f"키워드 검색 오류: {e}")
            return all_policies
    
    async def search_policies_by_region_and_age(
        self, 
        region: str = None, 
        age: int = None,
        max_results: int = 30
    ) -> List[Dict[str, Any]]:
        """
        지역과 나이를 고려한 정책 검색
        
        Args:
            region: 지역명 (예: '서울', '성북구')
            age: 나이
            max_results: 최대 결과 개수
            
        Returns:
            정책 리스트
        """
        search_terms = []
        
        # 지역 기반 검색어
        if region:
            region_terms = [region]
            if "구" in region:
                # 구 단위인 경우 상위 시도도 추가
                if "서울" not in region:
                    region_terms.append("서울")
            search_terms.extend(region_terms)
        
        # 나이 기반 검색어
        if age:
            if age <= 24:
                search_terms.extend(["대학생", "청년", "취업준비"])
            elif age <= 29:
                search_terms.extend(["청년", "취업", "창업"])
            elif age <= 34:
                search_terms.extend(["청년", "창업", "주거"])
        
        # 기본 청년 정책 키워드
        if not search_terms:
            search_terms = ["청년", "취업", "주거", "창업"]
        
        return await self.search_policies_by_keywords(search_terms, max_results)
    
    async def search_policies_by_category(
        self,
        category: str,
        user_context: Dict[str, Any] = None,
        max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """
        카테고리별 정책 검색
        
        Args:
            category: 정책 카테고리 (취업, 창업, 주거, 교육, 복지, 문화/예술, 참여권리, 기타)
            user_context: 사용자 컨텍스트
            max_results: 최대 결과 개수
            
        Returns:
            해당 카테고리의 정책 리스트
        """
        try:
            if category not in self.POLICY_CATEGORIES:
                logger.warning(f"알 수 없는 카테고리: {category}")
                category = "기타"
            
            # 카테고리 키워드로 검색
            keywords = self.POLICY_CATEGORIES[category]
            
            # 사용자 컨텍스트 추가
            if user_context:
                region = user_context.get("region")
                age = user_context.get("age")
                
                if region:
                    keywords.extend([region, "지역"])
                    
                if age:
                    if age <= 24:
                        keywords.extend(["대학생", "청년"])
                    elif age <= 29:
                        keywords.extend(["청년", "사회초년생"])
                    elif age <= 34:
                        keywords.extend(["청년", "직장인"])
            
            logger.info(f"카테고리 '{category}' 검색 키워드: {keywords[:5]}...")
            
            # 키워드로 검색 실행
            policies = await self.search_policies_by_keywords(keywords, max_results)
            
            # 카테고리 정보 추가
            for policy in policies:
                policy['matched_category'] = category
                policy['category_keywords'] = self.POLICY_CATEGORIES[category]
            
            logger.info(f"카테고리 '{category}' 검색 완료: {len(policies)}개 정책")
            return policies
            
        except Exception as e:
            logger.error(f"카테고리별 검색 오류: {e}")
            return []
    
    def classify_policy_category(self, policy: Dict[str, Any]) -> str:
        """
        정책을 8개 카테고리 중 하나로 분류
        
        Args:
            policy: 정책 정보
            
        Returns:
            분류된 카테고리명
        """
        try:
            # 정책 제목과 내용에서 키워드 검색
            title = policy.get('polyBizSjnm', '').lower()
            content = policy.get('sporCn', '').lower()
            target = policy.get('sporTarget', '').lower()
            
            text_to_analyze = f"{title} {content} {target}"
            
            # 각 카테고리별 점수 계산
            category_scores = {}
            
            for category, keywords in self.POLICY_CATEGORIES.items():
                score = 0
                for keyword in keywords:
                    # 제목에서 발견되면 가중치 높게
                    if keyword in title:
                        score += 3
                    # 내용에서 발견되면 기본 점수
                    elif keyword in text_to_analyze:
                        score += 1
                
                category_scores[category] = score
            
            # 가장 높은 점수의 카테고리 반환
            best_category = max(category_scores, key=category_scores.get)
            
            # 점수가 0이면 기타로 분류
            if category_scores[best_category] == 0:
                best_category = "기타"
            
            return best_category
            
        except Exception as e:
            logger.error(f"카테고리 분류 오류: {e}")
            return "기타"
    
    def _parse_policy_period(self, period_text: str) -> tuple[Optional[date], Optional[date]]:
        """
        정책 기간 텍스트를 파싱하여 시작일과 종료일을 반환
        
        Args:
            period_text: 신청기간 텍스트 (예: "2024.01.01~2024.12.31", "상시모집")
            
        Returns:
            (시작일, 종료일) 튜플, 파싱 실패 시 (None, None)
        """
        try:
            if not period_text or period_text.strip() == 'N/A':
                return None, None
            
            # 상시모집, 연중상시 등은 만료되지 않는 것으로 처리
            if any(keyword in period_text for keyword in ['상시', '연중', '수시', '계속']):
                return None, None
            
            # 날짜 패턴 찾기 (YYYY.MM.DD, YYYY-MM-DD, YYYY/MM/DD 형식)
            date_patterns = [
                r'(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})',  # YYYY.MM.DD 형식
                r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일',   # YYYY년 MM월 DD일 형식
                r'(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})',  # YY.MM.DD 형식
            ]
            
            dates = []
            for pattern in date_patterns:
                matches = re.findall(pattern, period_text)
                for match in matches:
                    try:
                        year, month, day = match
                        # 2자리 연도를 4자리로 변환
                        if len(year) == 2:
                            year = '20' + year if int(year) < 50 else '19' + year
                        
                        parsed_date = date(int(year), int(month), int(day))
                        dates.append(parsed_date)
                    except (ValueError, TypeError):
                        continue
            
            if len(dates) >= 2:
                # 시작일과 종료일 반환
                dates.sort()
                return dates[0], dates[-1]
            elif len(dates) == 1:
                # 하나의 날짜만 있으면 종료일로 간주
                return None, dates[0]
            
            return None, None
            
        except Exception as e:
            logger.warning(f"정책 기간 파싱 오류: {period_text} -> {e}")
            return None, None
    
    def _is_policy_expired(self, policy: Dict[str, Any]) -> bool:
        """
        정책이 만료되었는지 확인
        
        Args:
            policy: 정책 정보
            
        Returns:
            True if 만료됨, False if 유효함
        """
        try:
            # 신청기간 확인
            application_period = policy.get('rqutPrdCn', '')
            start_date, end_date = self._parse_policy_period(application_period)
            
            today = date.today()
            
            # 종료일이 있고 오늘보다 이전이면 만료
            if end_date and end_date < today:
                logger.debug(f"만료된 정책: {policy.get('polyBizSjnm', '')} (종료: {end_date})")
                return True
            
            # 사업기간도 확인 (있다면)
            business_period = policy.get('bizPrdCn', '')
            if business_period:
                biz_start, biz_end = self._parse_policy_period(business_period)
                if biz_end and biz_end < today:
                    logger.debug(f"사업기간 만료 정책: {policy.get('polyBizSjnm', '')} (사업종료: {biz_end})")
                    return True
            
            return False
            
        except Exception as e:
            logger.warning(f"정책 만료 확인 오류: {e}")
            # 에러 발생 시 안전하게 유효한 것으로 처리
            return False
    
    def _filter_active_policies(self, policies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        만료되지 않은 정책들만 필터링
        
        Args:
            policies: 전체 정책 리스트
            
        Returns:
            유효한 정책들만 포함된 리스트
        """
        try:
            active_policies = []
            expired_count = 0
            
            for policy in policies:
                if not self._is_policy_expired(policy):
                    active_policies.append(policy)
                else:
                    expired_count += 1
            
            if expired_count > 0:
                logger.info(f"만료된 정책 {expired_count}개 제외, 유효한 정책 {len(active_policies)}개 반환")
            
            return active_policies
            
        except Exception as e:
            logger.error(f"정책 필터링 오류: {e}")
            # 에러 발생 시 원본 리스트 반환
            return policies
    
    def format_policy_for_llm(self, policy: Dict[str, Any]) -> str:
        """
        LLM이 이해하기 쉽도록 정책 정보를 포맷팅
        
        Args:
            policy: 정책 정보 딕셔너리
            
        Returns:
            포맷팅된 정책 정보 문자열
        """
        try:
            # 정책 상태 확인
            is_expired = self._is_policy_expired(policy)
            status_emoji = "🔴" if is_expired else "🟢"
            status_text = "만료됨" if is_expired else "진행중"
            
            # 신청기간 파싱하여 더 자세한 정보 제공
            application_period = policy.get('rqutPrdCn', 'N/A')
            start_date, end_date = self._parse_policy_period(application_period)
            
            period_info = application_period
            if end_date:
                remaining_days = (end_date - date.today()).days
                if remaining_days > 0:
                    period_info += f" (마감까지 {remaining_days}일)"
                elif remaining_days == 0:
                    period_info += " (오늘 마감)"
            
            formatted = f"""
📋 정책명: {policy.get('polyBizSjnm', 'N/A')}

{status_emoji} 상태: {status_text}
📊 정책 분야: {policy.get('polyRlmCd', 'N/A')}
🏢 주관기관: {policy.get('cnsgNmor', 'N/A')}
🎯 지원대상: {policy.get('sporTarget', 'N/A')}
💰 지원내용: {policy.get('sporCn', 'N/A')}

📅 신청기간: {period_info}
📝 신청방법: {policy.get('rqutProcCn', 'N/A')}

🔗 상세정보 URL: {policy.get('rfcSiteUrla1', 'N/A')}
📞 문의처: {policy.get('cnsgNmor', 'N/A')}

📋 기타사항: {policy.get('etcCn', 'N/A')}
"""
            return formatted.strip()
            
        except Exception as e:
            logger.error(f"정책 포맷팅 오류: {e}")
            return f"정책명: {policy.get('polyBizSjnm', 'N/A')}"
    
    async def get_policy_suggestions(self, user_context: Dict[str, Any] = None) -> List[str]:
        """
        사용자 컨텍스트 기반 정책 제안
        
        Args:
            user_context: 사용자 정보 (나이, 지역, 관심사 등)
            
        Returns:
            정책 제안 문자열 리스트
        """
        try:
            region = user_context.get("region") if user_context else None
            age = user_context.get("age") if user_context else None
            
            policies = await self.search_policies_by_region_and_age(region, age, 10)
            
            suggestions = []
            for policy in policies[:5]:  # 상위 5개만
                suggestion = f"{policy.get('polyBizSjnm', 'N/A')} - {policy.get('cnsgNmor', 'N/A')}"
                suggestions.append(suggestion)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"정책 제안 생성 오류: {e}")
            return ["온통청년 정책 정보를 확인해보세요."]


# 전역 클라이언트 인스턴스
youthcenter_client = YouthCenterAPIClient()


async def test_youthcenter_api():
    """온통청년 API 테스트 함수"""
    try:
        print("🧪 온통청년 API 테스트 시작...")
        
        # 기본 검색 테스트
        print("\n1️⃣ 기본 검색 테스트 ('청년취업')")
        data = await youthcenter_client.search_policies(query="청년취업", display=10)
        
        if "youthPolicy" in data:
            print(f"✅ 검색 성공: {len(data['youthPolicy'])}개 유효한 정책 발견")
            
            for i, policy in enumerate(data["youthPolicy"][:3]):
                print(f"\n📋 정책 {i+1}: {policy.get('polyBizSjnm', 'N/A')}")
                print(f"🏢 주관기관: {policy.get('cnsgNmor', 'N/A')}")
                print(f"📅 신청기간: {policy.get('rqutPrdCn', 'N/A')}")
                
                # 만료 상태 확인
                is_expired = youthcenter_client._is_policy_expired(policy)
                status = "🔴 만료됨" if is_expired else "🟢 진행중"
                print(f"📊 상태: {status}")
        else:
            print("❌ 검색 결과 없음")
        
        # 만료 정책 필터링 테스트
        print("\n2️⃣ 만료 정책 필터링 테스트")
        
        # 테스트용 만료 정책 생성
        test_policies = [
            {
                'polyBizSjnm': '테스트 만료 정책',
                'rqutPrdCn': '2023.01.01~2023.12.31',  # 작년 정책
                'cnsgNmor': '테스트기관'
            },
            {
                'polyBizSjnm': '테스트 유효 정책',
                'rqutPrdCn': '상시모집',  # 상시 정책
                'cnsgNmor': '테스트기관'
            },
            {
                'polyBizSjnm': '테스트 진행중 정책',
                'rqutPrdCn': f'{date.today().year}.01.01~{date.today().year}.12.31',  # 올해 정책
                'cnsgNmor': '테스트기관'
            }
        ]
        
        filtered_policies = youthcenter_client._filter_active_policies(test_policies)
        print(f"원본 정책: {len(test_policies)}개 -> 필터링 후: {len(filtered_policies)}개")
        
        for policy in filtered_policies:
            print(f"✅ 유효: {policy['polyBizSjnm']} ({policy['rqutPrdCn']})")
        
        # 지역/나이 기반 검색 테스트
        print("\n3️⃣ 지역/나이 기반 검색 테스트")
        policies = await youthcenter_client.search_policies_by_region_and_age(
            region="서울", age=25, max_results=5
        )
        
        print(f"✅ 맞춤 검색 성공: {len(policies)}개 유효한 정책 발견")
        
        for i, policy in enumerate(policies[:2]):
            print(f"\n📋 정책 {i+1}: {policy.get('polyBizSjnm', 'N/A')}")
            formatted = youthcenter_client.format_policy_for_llm(policy)
            # 상태 정보가 포함된 포맷팅 결과 확인
            lines = formatted.split('\n')[:6]  # 처음 6줄만
            print('\n'.join(lines))
        
        print("\n🎉 온통청년 API 테스트 완료!")
        
    except Exception as e:
        print(f"❌ 테스트 실패: {e}")


if __name__ == "__main__":
    asyncio.run(test_youthcenter_api())
