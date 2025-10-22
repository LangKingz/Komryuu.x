import { NextRequest, NextResponse } from "next/server";

export const GET = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || "World";

  try {
    if (name) {
      return NextResponse.json(
        {
          message: `Hello ${name} from API`,
          success: true,
        },
        {
          status: 200,
        }
      );
    }

    return NextResponse.json(
      {
        message: "Hello from API",
        success: true,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error }, { status: 500 });
  }
};
