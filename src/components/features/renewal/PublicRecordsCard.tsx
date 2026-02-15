'use client';

import { useState } from 'react';
import { Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicRecordsCardProps {
  publicData: Record<string, any> | null;
  riskData?: Record<string, any> | null;
  sources: { rpr: boolean; propertyApi: boolean; nearmap: boolean; orion180: boolean } | null;
  lineOfBusiness: string | null;
}

export default function PublicRecordsCard({ publicData, riskData, sources, lineOfBusiness }: PublicRecordsCardProps) {
  const [expanded, setExpanded] = useState(true);

  const lob = (lineOfBusiness || '').toLowerCase();
  const isHome = lob.includes('home') || lob.includes('dwelling') ||
                 lob.includes('ho3') || lob.includes('ho5') || lob.includes('dp3');
  if (!isHome) return null;
  if (!publicData || Object.values(publicData).every(v => v == null)) return null;

  const fmtCurrency = (val: number | null | undefined) =>
    val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : null;

  const fmtDate = (val: string | null | undefined) => {
    if (!val) return null;
    try { return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return val; }
  };

  const listingStatus = publicData.listingStatus;
  const isListed = listingStatus && ['active', 'pending', 'sold'].includes(listingStatus.toLowerCase());

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Public Records</h3>
          {isListed && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              {listingStatus.toUpperCase()}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Owner */}
          {(publicData.ownerName || publicData.ownerOccupied != null) && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Owner</h4>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                {publicData.ownerName && <span className="font-medium">{publicData.ownerName}</span>}
                {publicData.ownerOccupied && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                    Owner-Occupied
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Property Details */}
          {(publicData.yearBuilt || publicData.sqft || publicData.stories || publicData.constructionType || publicData.roofType) && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Property</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {publicData.yearBuilt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Year Built</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{publicData.yearBuilt}</span>
                  </div>
                )}
                {publicData.sqft && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sq Ft</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{Number(publicData.sqft).toLocaleString()}</span>
                  </div>
                )}
                {publicData.stories && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Stories</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{publicData.stories}</span>
                  </div>
                )}
                {publicData.constructionType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Construction</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{publicData.constructionType}</span>
                  </div>
                )}
                {publicData.roofType && (
                  <div className="col-span-2 flex justify-between">
                    <span className="text-gray-500">Roof</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{publicData.roofType}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Valuation */}
          {(publicData.estimatedValue || publicData.lastSaleDate || publicData.lastSalePrice) && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Valuation</h4>
              <div className="space-y-1 text-sm">
                {publicData.estimatedValue && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estimated Value</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{fmtCurrency(publicData.estimatedValue)}</span>
                  </div>
                )}
                {(publicData.lastSaleDate || publicData.lastSalePrice) && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Sale</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {[fmtCurrency(publicData.lastSalePrice), fmtDate(publicData.lastSaleDate)].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Risk Profile (Orion180 HazardHub) */}
          {riskData && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Risk Profile</h4>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {([
                  ['Hurricane', riskData.hurricane],
                  ['Flood', riskData.flood],
                  ['Tornado', riskData.tornado],
                  ['Wildfire', riskData.wildfire],
                  ['Storm', riskData.convectionStorm],
                  ['Lightning', riskData.lightning],
                ] as [string, string | null][]).map(([label, grade]) => {
                  if (!grade) return null;
                  const g = grade.toUpperCase();
                  const color = g === 'A' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : g === 'B' ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                    : g === 'C' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500'
                    : g === 'D' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
                  return (
                    <span key={label} className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', color)}>
                      {label}: {g}
                    </span>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {riskData.femaFloodZone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">FEMA Flood Zone</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{riskData.femaFloodZone}</span>
                  </div>
                )}
                {riskData.protectionClass && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Protection Class</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{riskData.protectionClass}</span>
                  </div>
                )}
                {riskData.distanceToCoast != null && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-gray-500">Distance to Coast</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {Number(riskData.distanceToCoast) < 1
                        ? `${(Number(riskData.distanceToCoast) * 5280).toFixed(0)} ft`
                        : `${Number(riskData.distanceToCoast).toFixed(1)} mi`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source badges */}
          {sources && (
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-gray-400">Sources:</span>
              {(['rpr', 'propertyApi', 'nearmap', 'orion180'] as const).map(src => (
                <span
                  key={src}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded',
                    sources[src]
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                  )}
                >
                  {src === 'propertyApi' ? 'PropertyAPI' : src === 'rpr' ? 'RPR' : src === 'orion180' ? 'Orion180' : 'Nearmap'}
                  {sources[src] ? ' \u2713' : ' \u2717'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
