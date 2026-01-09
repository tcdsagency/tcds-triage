// Public Canopy Connect Thank You Page
// Customers land here after completing the Canopy Connect flow
// URL: /canopy-connect (set as CANOPY_REDIRECT_URL)

import Link from "next/link";

export default function CanopyConnectThankYouPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Thank You!
        </h1>
        <p className="text-gray-600 mb-6">
          Your insurance information has been successfully shared with TCDS Agency.
        </p>

        {/* What Happens Next */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
          <h2 className="font-semibold text-gray-900 mb-3 text-sm">What happens next?</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">1.</span>
              Our team will review your policy information
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">2.</span>
              We'll compare rates from our partner carriers
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">3.</span>
              An agent will reach out with personalized quotes
            </li>
          </ul>
        </div>

        {/* Expected Timeline */}
        <p className="text-sm text-gray-500 mb-6">
          You can expect to hear from us within <strong>1-2 business days</strong>.
        </p>

        {/* Contact Info */}
        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-600 mb-2">Questions? Contact us:</p>
          <div className="flex justify-center gap-4 text-sm">
            <a
              href="tel:+18177335622"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              (817) 733-5622
            </a>
            <span className="text-gray-300">|</span>
            <a
              href="mailto:service@tcdsagency.com"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              service@tcdsagency.com
            </a>
          </div>
        </div>

        {/* TCDS Branding */}
        <div className="mt-8 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            TCDS Agency - Your Trusted Insurance Partner
          </p>
        </div>
      </div>
    </div>
  );
}
