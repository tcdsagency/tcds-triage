"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Carrier {
  id: string;
  name: string;
}

interface CarrierSelectorProps {
  value: string | null;
  onChange: (carrierId: string | null, carrierName?: string) => void;
  placeholder?: string;
  allowClear?: boolean;
}

export function CarrierSelector({ value, onChange, placeholder = "Select carrier...", allowClear = true }: CarrierSelectorProps) {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/commissions/carriers?active=true")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCarriers(d.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCarrier = carriers.find((c) => c.id === value);
  const filtered = carriers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <span className={selectedCarrier ? "" : "text-gray-400"}>
          {selectedCarrier?.name || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {allowClear && value && (
            <X
              className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search carriers..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No carriers found</div>
            ) : (
              filtered.map((carrier) => (
                <button
                  key={carrier.id}
                  onClick={() => {
                    onChange(carrier.id, carrier.name);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {carrier.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
