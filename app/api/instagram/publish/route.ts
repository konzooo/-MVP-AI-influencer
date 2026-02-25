import { NextRequest, NextResponse } from "next/server";
import {
  verifyImageUrl,
  publishSingleImage,
  publishCarousel,
  publishStory,
} from "@/lib/instagram";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrls, caption, hashtags, postType, scheduledTime } = body;

    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    // Validate caption length
    const fullCaption = caption + (hashtags?.length ? "\n\n" + hashtags.map((t: string) => `#${t.replace(/^#/, "")}`).join(" ") : "");
    if (fullCaption.length > 2200) {
      return NextResponse.json(
        { error: "Caption + hashtags exceed 2,200 character limit" },
        { status: 400 }
      );
    }

    if (hashtags && hashtags.length > 30) {
      return NextResponse.json(
        { error: "Maximum 30 hashtags allowed" },
        { status: 400 }
      );
    }

    // Verify all image URLs are accessible
    const verifications = await Promise.all(
      imageUrls.map((url: string) => verifyImageUrl(url))
    );
    const failedIndex = verifications.findIndex((ok) => !ok);
    if (failedIndex !== -1) {
      return NextResponse.json(
        {
          error: `Image ${failedIndex + 1} is no longer accessible. It may have expired — please regenerate it.`,
          retryable: false,
        },
        { status: 400 }
      );
    }

    let result;

    if (postType === "story") {
      result = await publishStory({ imageUrl: imageUrls[0] });
    } else if (postType === "carousel" && imageUrls.length >= 2) {
      result = await publishCarousel({
        imageUrls,
        caption: caption || "",
        hashtags: hashtags || [],
        scheduledTime,
      });
    } else {
      // Single image (or carousel with only 1 image)
      result = await publishSingleImage({
        imageUrl: imageUrls[0],
        caption: caption || "",
        hashtags: hashtags || [],
        scheduledTime,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, retryable: result.retryable },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      igPostId: result.igPostId,
      permalink: result.permalink,
      scheduled: !!scheduledTime,
    });
  } catch (error) {
    console.error("Instagram publish error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        retryable: true,
      },
      { status: 500 }
    );
  }
}
