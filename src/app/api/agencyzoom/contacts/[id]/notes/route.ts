// API Route: /api/agencyzoom/contacts/[id]/notes/route.ts
// Fetch and create notes for AgencyZoom contacts

import { NextRequest, NextResponse } from "next/server";
import { Note, NotesResponse, AddNoteRequest, AddNoteResponse } from "@/types/customer-profile";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// =============================================================================
// CONFIGURATION
// =============================================================================

function getAgencyZoomAuth() {
  const username = process.env.AGENCYZOOM_API_USERNAME || process.env.AGENCYZOOM_USERNAME;
  const password = process.env.AGENCYZOOM_API_PASSWORD || process.env.AGENCYZOOM_PASSWORD;
  return Buffer.from(`${username}:${password}`).toString("base64");
}

// =============================================================================
// GET - FETCH NOTES
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");

    let notes: Note[] = [];

    // Notes are embedded in the customer object
    try {
      const client = getAgencyZoomClient();
      const v1Notes = await client.getCustomerNotes(parseInt(contactId));

      if (v1Notes && v1Notes.length > 0) {
        // Notes come from embedded customer.notes array
        // Format: { note (body), createdBy (string), createdAt (createDate), type, title }
        notes = v1Notes.map((note: any) => ({
          id: String(note.id || note.noteId || Date.now()),
          content: note.note || note.notes || note.content || note.body || "",
          subject: note.subject || note.title || note.type,
          createdAt: note.createdAt || note.createDate || note.createdDate,
          createdBy: typeof note.createdBy === 'string'
            ? { id: 'unknown', name: note.createdBy }
            : note.createdBy ? {
                id: String(note.createdBy.id || note.createdBy),
                name: note.createdBy.name || note.createdByName || "Unknown"
              } : undefined,
          source: "agencyzoom" as const
        }));
      }
    } catch (v1Error) {
      console.warn("V1 API notes fetch failed:", v1Error);

      // Fallback: Try openapi endpoint with Basic auth (likely won't work but try anyway)
      const auth = getAgencyZoomAuth();

      const response = await fetch(
        `https://app.agencyzoom.com/openapi/contacts/${contactId}/activities?type=Note&limit=${limit}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const activities = data.activities || data || [];

        notes = activities.map((activity: any) => ({
          id: String(activity.id || activity.activityId),
          content: activity.notes || activity.content || activity.description || "",
          subject: activity.subject || activity.title,
          createdAt: activity.activityDate || activity.createdDate || activity.createdAt,
          createdBy: activity.createdBy ? {
            id: String(activity.createdBy.id || activity.createdBy),
            name: activity.createdBy.name || activity.createdByName || "Unknown"
          } : undefined,
          source: "agencyzoom" as const
        }));
      }
    }
    
    // Filter out empty notes and sort by date descending
    notes = notes
      .filter(n => n.content && n.content.trim().length > 0)
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
    
    const result: NotesResponse = {
      success: true,
      notes,
      totalCount: notes.length
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("Notes fetch error:", error);
    return NextResponse.json({
      success: false,
      notes: [],
      totalCount: 0,
      error: "Failed to fetch notes"
    }, { status: 500 });
  }
}

// =============================================================================
// POST - CREATE NOTE
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const body: AddNoteRequest = await request.json();
    
    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: "Note content is required"
      }, { status: 400 });
    }
    
    const auth = getAgencyZoomAuth();
    
    // Create activity in AgencyZoom
    const activityPayload = {
      type: body.type || "Note",
      subject: body.subject || "Note from TCDS",
      notes: body.content.trim(),
      activityDate: new Date().toISOString()
    };
    
    const response = await fetch(
      `https://app.agencyzoom.com/openapi/contacts/${contactId}/activities`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(activityPayload)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AgencyZoom note creation failed: ${response.status}`, errorText);
      return NextResponse.json({
        success: false,
        error: `Failed to create note: ${response.status}`
      }, { status: response.status });
    }
    
    const data = await response.json();
    
    // Return the created note
    const note: Note = {
      id: String(data.id || data.activityId || Date.now()),
      content: body.content.trim(),
      subject: body.subject,
      createdAt: new Date().toISOString(),
      source: "agencyzoom"
    };
    
    const result: AddNoteResponse = {
      success: true,
      note
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("Note creation error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to create note"
    }, { status: 500 });
  }
}
