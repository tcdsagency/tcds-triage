import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { googleReviews, customers } from "@/db/schema";
import { eq, ilike, or, sql } from "drizzle-orm";

// =============================================================================
// POST /api/google-reviews/import - Import Google reviews
// Supports manual paste, CSV, or structured JSON
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviews, source = "manual" } = body;

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json(
        { success: false, error: "No reviews provided" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    const results = {
      imported: 0,
      skipped: 0,
      matched: 0,
      errors: [] as string[],
    };

    for (const review of reviews) {
      try {
        // Validate required fields
        if (!review.reviewerName || !review.rating) {
          results.errors.push(`Skipping review: missing name or rating`);
          results.skipped++;
          continue;
        }

        // Check for duplicate by Google review ID or name+timestamp
        const existingReview = review.googleReviewId
          ? await db
              .select({ id: googleReviews.id })
              .from(googleReviews)
              .where(eq(googleReviews.googleReviewId, review.googleReviewId))
              .limit(1)
          : [];

        if (existingReview.length > 0) {
          results.skipped++;
          continue;
        }

        // Normalize reviewer name for matching
        const normalizedName = normalizeNameForMatching(review.reviewerName);

        // Try to auto-match to customer
        const matchResult = await tryMatchToCustomer(
          tenantId,
          review.reviewerName,
          normalizedName
        );

        // Insert review
        await db.insert(googleReviews).values({
          tenantId,
          googleReviewId: review.googleReviewId || null,
          reviewerName: review.reviewerName,
          reviewerNameNormalized: normalizedName,
          reviewerProfileUrl: review.reviewerProfileUrl || null,
          rating: parseInt(review.rating),
          comment: review.comment || null,
          reviewTimestamp: review.reviewTimestamp
            ? new Date(review.reviewTimestamp)
            : new Date(),
          matchedCustomerId: matchResult?.customerId || null,
          matchedCustomerName: matchResult?.customerName || null,
          matchedCustomerPhone: matchResult?.customerPhone || null,
          matchConfidence: matchResult?.confidence || null,
          matchedAt: matchResult ? new Date() : null,
          importSource: source,
          rawPayload: review,
        });

        results.imported++;
        if (matchResult) {
          results.matched++;
        }
      } catch (error) {
        results.errors.push(
          `Error importing review from ${review.reviewerName}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error importing Google reviews:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import reviews" },
      { status: 500 }
    );
  }
}

// Helper: Normalize name for matching
function normalizeNameForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Helper: Try to match reviewer to existing customer
async function tryMatchToCustomer(
  tenantId: string,
  reviewerName: string,
  normalizedName: string
): Promise<{
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  confidence: "exact" | "high" | "medium" | "low";
} | null> {
  try {
    // Try exact name match first
    const exactMatch = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
      })
      .from(customers)
      .where(
        sql`${customers.tenantId} = ${tenantId} AND lower(concat(${customers.firstName}, ' ', ${customers.lastName})) = ${normalizedName}`
      )
      .limit(1);

    if (exactMatch.length > 0) {
      const customer = exactMatch[0];
      return {
        customerId: customer.agencyzoomId || customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerPhone: customer.phone,
        confidence: "high",
      };
    }

    // Try fuzzy match (first name + last name initial or vice versa)
    const nameParts = normalizedName.split(" ");
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];

      const fuzzyMatch = await db
        .select({
          id: customers.id,
          agencyzoomId: customers.agencyzoomId,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
        })
        .from(customers)
        .where(
          sql`${customers.tenantId} = ${tenantId} AND (
            (lower(${customers.firstName}) = ${firstName} AND lower(${customers.lastName}) LIKE ${lastName + "%"}) OR
            (lower(${customers.firstName}) LIKE ${firstName + "%"} AND lower(${customers.lastName}) = ${lastName})
          )`
        )
        .limit(1);

      if (fuzzyMatch.length > 0) {
        const customer = fuzzyMatch[0];
        return {
          customerId: customer.agencyzoomId || customer.id,
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerPhone: customer.phone,
          confidence: "medium",
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error matching customer:", error);
    return null;
  }
}
