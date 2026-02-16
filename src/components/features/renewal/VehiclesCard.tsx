'use client';

import { Car, Users } from 'lucide-react';
import type { RenewalSnapshot, BaselineSnapshot, CanonicalVehicle, CanonicalDriver } from '@/types/renewal.types';

interface VehiclesCardProps {
  renewalSnapshot: RenewalSnapshot | null;
  baselineSnapshot: BaselineSnapshot | null;
}

function VehicleItem({ vehicle, status }: { vehicle: CanonicalVehicle; status?: 'added' | 'removed' }) {
  const label = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Unknown Vehicle';
  const vinSuffix = vehicle.vin ? `...${vehicle.vin.slice(-4)}` : '';

  return (
    <div className="flex items-center gap-2 text-xs">
      <Car className={`h-3 w-3 shrink-0 ${
        status === 'removed' ? 'text-red-400' :
        status === 'added' ? 'text-green-400' :
        'text-gray-400'
      }`} />
      <span className={`font-medium ${
        status === 'removed' ? 'text-red-600 line-through' :
        status === 'added' ? 'text-green-600' :
        'text-gray-700'
      }`}>
        {label}
      </span>
      {vinSuffix && <span className="text-gray-400 text-[10px]">({vinSuffix})</span>}
      {status && (
        <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
          status === 'removed' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
        }`}>
          {status === 'removed' ? 'REMOVED' : 'NEW'}
        </span>
      )}
    </div>
  );
}

function DriverItem({ driver }: { driver: CanonicalDriver }) {
  const name = driver.name || 'Unknown Driver';
  return (
    <div className="flex items-center gap-2 text-xs">
      <Users className="h-3 w-3 shrink-0 text-gray-400" />
      <span className="text-gray-700">{name}</span>
      {driver.relationship && <span className="text-gray-400">({driver.relationship})</span>}
    </div>
  );
}

export default function VehiclesCard({ renewalSnapshot, baselineSnapshot }: VehiclesCardProps) {
  const renewalVehicles = renewalSnapshot?.vehicles || [];
  const baselineVehicles = baselineSnapshot?.vehicles || [];
  const drivers = renewalSnapshot?.drivers || baselineSnapshot?.drivers || [];

  if (renewalVehicles.length === 0 && baselineVehicles.length === 0 && drivers.length === 0) {
    return null;
  }

  // Determine added/removed vehicles
  const renewalVins = new Set(renewalVehicles.map(v => v.vin).filter(Boolean));
  const baselineVins = new Set(baselineVehicles.map(v => v.vin).filter(Boolean));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      {/* Vehicles */}
      {(renewalVehicles.length > 0 || baselineVehicles.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2 flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5" />
            Vehicles ({renewalVehicles.length})
          </h4>
          <div className="space-y-1.5">
            {renewalVehicles.map((v, i) => {
              const isAdded = v.vin ? !baselineVins.has(v.vin) : false;
              return <VehicleItem key={v.vin || `r-${i}`} vehicle={v} status={isAdded ? 'added' : undefined} />;
            })}
            {baselineVehicles
              .filter(v => v.vin && !renewalVins.has(v.vin))
              .map((v, i) => (
                <VehicleItem key={v.vin || `b-${i}`} vehicle={v} status="removed" />
              ))}
          </div>
        </div>
      )}

      {/* Drivers */}
      {drivers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Drivers ({drivers.length})
          </h4>
          <div className="space-y-1.5">
            {drivers.map((d, i) => (
              <DriverItem key={d.name || i} driver={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
