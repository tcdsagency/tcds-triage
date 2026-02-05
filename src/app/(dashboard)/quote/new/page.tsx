"use client";

import { useRouter } from "next/navigation";
import { Car, Home, Ship, Building2, Droplets, Shield, User, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuoteType {
  id: string;
  name: string;
  icon: any;
  description: string;
  available: boolean;
}

const QUOTE_TYPES: QuoteType[] = [
  { id: "personal_auto", name: "Personal Auto", icon: Car, description: "Auto insurance quote", available: true },
  { id: "homeowners", name: "Homeowners", icon: Home, description: "Home insurance quote", available: true },
  { id: "mobile_home", name: "Mobile Home", icon: Home, description: "Manufactured home", available: true },
  { id: "renters", name: "Renters", icon: Home, description: "Renters insurance", available: true },
  { id: "umbrella", name: "Umbrella", icon: Shield, description: "Excess liability", available: true },
  { id: "bop", name: "Business Owner's (BOP)", icon: Building2, description: "Property + Liability bundle", available: true },
  { id: "general_liability", name: "General Liability", icon: Shield, description: "Commercial liability", available: true },
  { id: "workers_comp", name: "Workers Comp", icon: User, description: "Employee coverage", available: true },
  { id: "auto_home_bundle", name: "Auto + Home", icon: Home, description: "Bundle discount", available: true },
  { id: "recreational", name: "Recreational", icon: Ship, description: "Boat, RV, ATV", available: true },
  { id: "flood", name: "Flood", icon: Droplets, description: "Flood insurance", available: true },
];

export default function QuoteIntakePage() {
  const router = useRouter();

  return (
    <div>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered Quote Assistant
          </Badge>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">New Quote</h1>
          <p className="text-gray-500 dark:text-gray-400">Select a quote type to get started</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {QUOTE_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => {
                if (!type.available) return;
                router.push(`/quote/new/${type.id}`);
              }}
              disabled={!type.available}
              className={cn(
                "p-6 rounded-xl border text-left transition-all",
                type.available
                  ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-500/50 active:scale-[0.98] cursor-pointer"
                  : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed"
              )}
            >
              <type.icon className={cn("w-8 h-8 mb-3", type.available ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-600")} />
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{type.name}</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{type.description}</p>
              {!type.available && <Badge variant="secondary" className="mt-2 text-xs">Coming Soon</Badge>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
