// types/policy.ts
export interface Policy {
  id: number;
  title: string;
  category: string;
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
    lastUpdate: string;
  };
}

export interface DistrictPolicies {
  [districtName: string]: Policy[];
}

export interface DistrictPoliciesResponse {
  data: DistrictPolicies;
  metadata: {
    totalPolicies: number;
    districts: string[];
    lastUpdate: string;
    source: string;
  };
}

// hooks/useDistrictPolicies.ts
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const useDistrictPolicies = (districts?: string[]) => {
  const [policies, setPolicies] = useState<DistrictPolicies>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPolicies();
  }, [districts]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const params = districts ? `?districts=${districts.join(',')}` : '';
      const response = await axios.get<DistrictPoliciesResponse>(
        `${API_BASE_URL}/api/district-policies${params}`
      );
      setPolicies(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch policies');
      console.error('Error fetching district policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshPolicies = async () => {
    const params = districts ? `?districts=${districts.join(',')}&forceRefresh=true` : '?forceRefresh=true';
    const response = await axios.get<DistrictPoliciesResponse>(
      `${API_BASE_URL}/api/district-policies${params}`
    );
    setPolicies(response.data.data);
  };

  return { policies, loading, error, refreshPolicies };
};

// components/DistrictPoliciesGrid.tsx
import React from 'react';
import { useDistrictPolicies } from '@/hooks/useDistrictPolicies';

export const DistrictPoliciesGrid: React.FC = () => {
  // 특정 구만 가져오기
  const { policies, loading, error } = useDistrictPolicies(['Gangnam-gu', 'Seocho-gu', 'Gangdong-gu']);

  if (loading) return <div>Loading policies...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="policies-container">
      {Object.entries(policies).map(([district, districtPolicies]) => (
        <div key={district} className="district-section">
          <h2>{district}</h2>
          <div className="policy-grid">
            {districtPolicies.map(policy => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// components/PolicyCard.tsx
const PolicyCard: React.FC<{ policy: Policy }> = ({ policy }) => {
  return (
    <div className={`policy-card ${policy.isHot ? 'hot' : ''}`}>
      <img src={policy.image} alt={policy.title} />
      <div className="policy-content">
        {policy.isHot && <span className="hot-badge">HOT</span>}
        <span className="category">{policy.category}</span>
        <h3>{policy.title}</h3>
        <p>{policy.description}</p>
        <div className="policy-meta">
          <span className="target">{policy.target}</span>
          <span className="deadline">{policy.deadline}</span>
        </div>
        {policy.metadata?.applicationUrl && (
          <a href={policy.metadata.applicationUrl} target="_blank" rel="noopener noreferrer">
            신청하기
          </a>
        )}
      </div>
    </div>
  );
};

// pages/api/district-policies/[district].ts (Next.js API Route Proxy)
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { district } = req.query;
  
  try {
    const response = await axios.get(
      `${process.env.BACKEND_URL}/api/district-policies/${district}`,
      { params: req.query }
    );
    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch district policies' });
  }
}

// Usage Example 1: Static replacement for mock data
import { useDistrictPolicies } from '@/hooks/useDistrictPolicies';

export const PoliciesPage = () => {
  const { policies, loading } = useDistrictPolicies();
  
  // 이제 districtPolicies 대신 API에서 받은 실제 데이터 사용
  if (loading) return <LoadingSpinner />;
  
  return <YourExistingComponent districtPolicies={policies} />;
};

// Usage Example 2: Fetch specific district on demand
export const DistrictDetail = ({ districtId }: { districtId: string }) => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  
  useEffect(() => {
    axios.get(`/api/district-policies/${districtId}`)
      .then(res => setPolicies(res.data.policies))
      .catch(err => console.error(err));
  }, [districtId]);
  
  return (
    <div>
      {policies.map(policy => (
        <PolicyCard key={policy.id} policy={policy} />
      ))}
    </div>
  );
};

// Usage Example 3: Hot policies only
export const HotPoliciesWidget = () => {
  const [hotPolicies, setHotPolicies] = useState<Policy[]>([]);
  
  useEffect(() => {
    axios.get('/api/hot-policies')
      .then(res => setHotPolicies(res.data.policies))
      .catch(err => console.error(err));
  }, []);
  
  return (
    <div className="hot-policies">
      <h2>🔥 인기 정책</h2>
      {hotPolicies.map(policy => (
        <PolicyCard key={policy.id} policy={policy} />
      ))}
    </div>
  );
};