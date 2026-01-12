// Debug endpoint to test AgencyZoom API calls
// GET /api/agencyzoom/debug?customerId=123

import { NextRequest, NextResponse } from "next/server";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// Raw API call helper
async function rawApiCall(baseUrl: string, endpoint: string, token: string): Promise<any> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.substring(0, 500) };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const customerId = searchParams.get("customerId");

  if (!customerId) {
    return NextResponse.json({
      error: "customerId required",
      usage: "/api/agencyzoom/debug?customerId=123"
    }, { status: 400 });
  }

  const results: any = {
    customerId,
    timestamp: new Date().toISOString(),
    tests: {}
  };

  const client = getAgencyZoomClient();

  // Test 1: Get customer (full raw response)
  try {
    const customer = await client.getCustomer(parseInt(customerId));
    results.tests.customer = {
      success: true,
      data: customer ? {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        phone: customer.phone,
        // Check if notes are embedded in customer object
        hasNotesField: 'notes' in (customer as any),
        notesValue: (customer as any).notes,
        hasActivitiesField: 'activities' in (customer as any),
        // List all fields to see what's available
        allFields: Object.keys(customer || {})
      } : null
    };
  } catch (error: any) {
    results.tests.customer = {
      success: false,
      error: error.message
    };
  }

  // Test 2: Get notes via v1 API
  try {
    const notes = await client.getCustomerNotes(parseInt(customerId));
    results.tests.notes_v1 = {
      success: true,
      count: notes?.length || 0,
      sample: notes?.slice(0, 3) || []
    };
  } catch (error: any) {
    results.tests.notes_v1 = {
      success: false,
      error: error.message
    };
  }

  // Test 3: Get activities via v1 API
  try {
    const activities = await client.getCustomerActivities(parseInt(customerId));
    results.tests.activities_v1 = {
      success: true,
      count: activities?.length || 0,
      sample: activities?.slice(0, 3) || []
    };
  } catch (error: any) {
    results.tests.activities_v1 = {
      success: false,
      error: error.message
    };
  }

  // Test 4: Try different API paths with JWT auth
  try {
    // Get JWT token by making any request first
    const username = process.env.AGENCYZOOM_API_USERNAME || process.env.AGENCYZOOM_USERNAME;
    const password = process.env.AGENCYZOOM_API_PASSWORD || process.env.AGENCYZOOM_PASSWORD;

    if (username && password) {
      // Get JWT token
      const authResponse = await fetch("https://api.agencyzoom.com/v1/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, version: "1.0" }),
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        const token = authData.jwt;
        results.tests.auth = { success: true };

        // Test alternative endpoints with raw API calls
        const baseUrl = "https://api.agencyzoom.com";

        // Try /v1/api/households/{id}/notes
        const householdNotes = await rawApiCall(baseUrl, `/v1/api/households/${customerId}/notes`, token);
        results.tests.household_notes = householdNotes;

        // Try /v1/api/households/{id}/activities
        const householdActivities = await rawApiCall(baseUrl, `/v1/api/households/${customerId}/activities`, token);
        results.tests.household_activities = householdActivities;

        // Try /v1/api/contacts/{id}/notes
        const contactNotes = await rawApiCall(baseUrl, `/v1/api/contacts/${customerId}/notes`, token);
        results.tests.contact_notes = contactNotes;

        // Try /v1/api/activities?householdId={id}
        const activitiesByHousehold = await rawApiCall(baseUrl, `/v1/api/activities?householdId=${customerId}`, token);
        results.tests.activities_by_household = activitiesByHousehold;

        // Try /v1/api/notes?householdId={id}
        const notesByHousehold = await rawApiCall(baseUrl, `/v1/api/notes?householdId=${customerId}`, token);
        results.tests.notes_by_household = notesByHousehold;
      } else {
        results.tests.auth = {
          success: false,
          status: authResponse.status,
          error: await authResponse.text()
        };
      }
    }
  } catch (error: any) {
    results.tests.alternative_endpoints = {
      success: false,
      error: error.message
    };
  }

  // Test 5: Try openapi endpoint with Basic auth
  const username = process.env.AGENCYZOOM_API_USERNAME || process.env.AGENCYZOOM_USERNAME;
  const password = process.env.AGENCYZOOM_API_PASSWORD || process.env.AGENCYZOOM_PASSWORD;

  if (username && password) {
    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    // Try activities endpoint
    try {
      const response = await fetch(
        `https://app.agencyzoom.com/openapi/contacts/${customerId}/activities?limit=10`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      results.tests.openapi_activities = {
        success: response.ok,
        status: response.status,
        data: typeof data === 'object' ? data : { raw: data.substring(0, 500) }
      };
    } catch (error: any) {
      results.tests.openapi_activities = {
        success: false,
        error: error.message
      };
    }

    // Try notes endpoint
    try {
      const response = await fetch(
        `https://app.agencyzoom.com/openapi/contacts/${customerId}/notes?limit=10`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      results.tests.openapi_notes = {
        success: response.ok,
        status: response.status,
        data: typeof data === 'object' ? data : { raw: data.substring(0, 500) }
      };
    } catch (error: any) {
      results.tests.openapi_notes = {
        success: false,
        error: error.message
      };
    }
  } else {
    results.tests.openapi = {
      skipped: true,
      reason: "AGENCYZOOM_API_USERNAME/AGENCYZOOM_API_PASSWORD not configured"
    };
  }

  return NextResponse.json(results);
}
