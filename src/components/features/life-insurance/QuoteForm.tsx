"use client";

import { useState, useEffect } from "react";
import {
  User,
  Calendar,
  MapPin,
  Heart,
  Cigarette,
  DollarSign,
  Clock,
  Shield,
  ChevronDown,
} from "lucide-react";
import {
  QuoteFormProps,
  QuoteRequestParams,
  PolicyType,
  HealthClass,
  TobaccoUse,
  Gender,
  US_STATES,
  TERM_LENGTH_OPTIONS,
  COVERAGE_AMOUNT_OPTIONS,
  HEALTH_CLASS_DESCRIPTIONS,
  POLICY_TYPE_DESCRIPTIONS,
  formatCurrency,
} from "@/types/lifeInsurance.types";

export function QuoteForm({
  customerData,
  prefilledValues,
  onSubmit,
  isLoading,
}: QuoteFormProps) {
  const [formData, setFormData] = useState<Partial<QuoteRequestParams>>({
    firstName: customerData.firstName || "",
    lastName: customerData.lastName || "",
    dateOfBirth: customerData.dateOfBirth || "",
    gender: customerData.gender || Gender.MALE,
    state: customerData.state || "",
    healthClass: HealthClass.GOOD,
    tobaccoUse: TobaccoUse.NEVER,
    coverageAmount: 500000,
    termLength: 20,
    policyType: PolicyType.TERM,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when customerData changes (handles async data loading)
  useEffect(() => {
    if (customerData) {
      setFormData((prev) => ({
        ...prev,
        firstName: customerData.firstName || prev.firstName || "",
        lastName: customerData.lastName || prev.lastName || "",
        dateOfBirth: customerData.dateOfBirth || prev.dateOfBirth || "",
        gender: customerData.gender || prev.gender || Gender.MALE,
        state: customerData.state || prev.state || "",
      }));
    }
  }, [customerData]);

  // Update form when prefilled values change
  useEffect(() => {
    if (prefilledValues) {
      setFormData((prev) => ({ ...prev, ...prefilledValues }));
    }
  }, [prefilledValues]);

  const handleChange = (
    field: keyof QuoteRequestParams,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field changes
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName?.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName?.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = "Date of birth is required";
    } else {
      // Validate age
      const age = calculateAge(formData.dateOfBirth);
      if (age < 18) {
        newErrors.dateOfBirth = "Applicant must be at least 18 years old";
      } else if (age > 85) {
        newErrors.dateOfBirth = "Applicant must be 85 years old or younger";
      }
    }
    if (!formData.state) {
      newErrors.state = "State is required";
    }
    if (!formData.coverageAmount) {
      newErrors.coverageAmount = "Coverage amount is required";
    }
    if (!formData.termLength) {
      newErrors.termLength = "Term length is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData as QuoteRequestParams);
    }
  };

  const calculateAge = (dob: string): number => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const age = formData.dateOfBirth ? calculateAge(formData.dateOfBirth) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600" />
          Personal Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* First Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={formData.firstName || ""}
              onChange={(e) => handleChange("firstName", e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.firstName ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="John"
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={formData.lastName || ""}
              onChange={(e) => handleChange("lastName", e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.lastName ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Smith"
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
            )}
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              Date of Birth
            </label>
            <input
              type="date"
              value={formData.dateOfBirth || ""}
              onChange={(e) => handleChange("dateOfBirth", e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.dateOfBirth ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.dateOfBirth && (
              <p className="mt-1 text-xs text-red-600">{errors.dateOfBirth}</p>
            )}
            {age && !errors.dateOfBirth && (
              <p className="mt-1 text-xs text-gray-500">Age: {age}</p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={formData.gender || ""}
              onChange={(e) => handleChange("gender", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={Gender.MALE}>Male</option>
              <option value={Gender.FEMALE}>Female</option>
            </select>
          </div>

          {/* State */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <MapPin className="w-3 h-3 inline mr-1" />
              State
            </label>
            <select
              value={formData.state || ""}
              onChange={(e) => handleChange("state", e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.state ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select state...</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
            {errors.state && (
              <p className="mt-1 text-xs text-red-600">{errors.state}</p>
            )}
          </div>
        </div>
      </div>

      {/* Health Information Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          Health Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Health Class */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Health Class
            </label>
            <select
              value={formData.healthClass || ""}
              onChange={(e) =>
                handleChange("healthClass", e.target.value as HealthClass)
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.values(HealthClass).map((hc) => (
                <option key={hc} value={hc}>
                  {hc.charAt(0).toUpperCase() + hc.slice(1)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.healthClass &&
                HEALTH_CLASS_DESCRIPTIONS[formData.healthClass]}
            </p>
          </div>

          {/* Tobacco Use */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Cigarette className="w-3 h-3 inline mr-1" />
              Tobacco Use
            </label>
            <select
              value={formData.tobaccoUse || ""}
              onChange={(e) =>
                handleChange("tobaccoUse", e.target.value as TobaccoUse)
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={TobaccoUse.NEVER}>Never</option>
              <option value={TobaccoUse.PREVIOUS}>Previous (quit 12+ months)</option>
              <option value={TobaccoUse.CURRENT}>Current User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Coverage Details Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          Coverage Details
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Coverage Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <DollarSign className="w-3 h-3 inline mr-1" />
              Coverage Amount
            </label>
            <select
              value={formData.coverageAmount || ""}
              onChange={(e) =>
                handleChange("coverageAmount", parseInt(e.target.value))
              }
              className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.coverageAmount ? "border-red-500" : "border-gray-300"
              }`}
            >
              {COVERAGE_AMOUNT_OPTIONS.map((amount) => (
                <option key={amount} value={amount}>
                  {formatCurrency(amount)}
                </option>
              ))}
            </select>
            {errors.coverageAmount && (
              <p className="mt-1 text-xs text-red-600">
                {errors.coverageAmount}
              </p>
            )}
          </div>

          {/* Term Length */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Term Length
            </label>
            <select
              value={formData.termLength || ""}
              onChange={(e) =>
                handleChange("termLength", parseInt(e.target.value))
              }
              className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.termLength ? "border-red-500" : "border-gray-300"
              }`}
            >
              {TERM_LENGTH_OPTIONS.map((years) => (
                <option key={years} value={years}>
                  {years} Years
                </option>
              ))}
            </select>
            {errors.termLength && (
              <p className="mt-1 text-xs text-red-600">{errors.termLength}</p>
            )}
          </div>

          {/* Policy Type */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Policy Type
            </label>
            <select
              value={formData.policyType || ""}
              onChange={(e) =>
                handleChange("policyType", e.target.value as PolicyType)
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.values(PolicyType).map((pt) => (
                <option key={pt} value={pt}>
                  {pt
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.policyType &&
                POLICY_TYPE_DESCRIPTIONS[formData.policyType]}
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Getting Quotes...
          </span>
        ) : (
          "Get Instant Quotes"
        )}
      </button>
    </form>
  );
}

export default QuoteForm;
