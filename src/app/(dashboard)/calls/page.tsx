"use client";

import { useState } from "react";
import CallPopup from "@/components/features/CallPopup";

export default function CallsPage() {
  const [showPopup, setShowPopup] = useState(false);
  const [testPhone, setTestPhone] = useState("(205) 555-1234");
  const [testSessionId, setTestSessionId] = useState("test-123");

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
        <p className="text-gray-600 mt-2">
          Call management and history.
        </p>
      </div>

      {/* Test CallPopup */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Test Call Popup</h2>
        
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="border rounded px-3 py-2 w-48"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Session ID</label>
            <input
              type="text"
              value={testSessionId}
              onChange={(e) => setTestSessionId(e.target.value)}
              className="border rounded px-3 py-2 w-48"
            />
          </div>
        </div>

        <button
          onClick={() => setShowPopup(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          📞 Open Call Popup
        </button>

        <p className="text-sm text-gray-500 mt-4">
          To test, send transcripts to the WebSocket server:
          <code className="block bg-gray-100 p-2 rounded mt-2 text-xs">
            curl -X POST http://34.145.14.37:5002/api/transcription/webhook \<br/>
            &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br/>
            &nbsp;&nbsp;-d &apos;&#123;&quot;sessionId&quot;:&quot;{testSessionId}&quot;,&quot;speaker&quot;:&quot;customer&quot;,&quot;text&quot;:&quot;Hello&quot;&#125;&apos;
          </code>
        </p>
      </div>

      {/* CallPopup */}
      {showPopup && (
        <CallPopup
          sessionId={testSessionId}
          phoneNumber={testPhone}
          direction="inbound"
          isVisible={showPopup}
          onClose={() => setShowPopup(false)}
          onMinimize={() => {}}
        />
      )}
    </div>
  );
}
