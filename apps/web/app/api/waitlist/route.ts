import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CSV_FILE = path.join(DATA_DIR, "waitlist.csv");
const JSON_FILE = path.join(DATA_DIR, "waitlist.json");

function ensureFilesExist() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CSV_FILE)) {
    const csvHeader = "Timestamp,Name,Email,UserAgent\n";
    fs.writeFileSync(CSV_FILE, csvHeader, "utf-8");
  }

  if (!fs.existsSync(JSON_FILE)) {
    fs.writeFileSync(JSON_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

export async function POST(req: NextRequest) {
  try {
    let name = "";
    let email = "";

    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json();
        name = body.name || "";
        email = body.email || "";
      } else {
        const text = await req.text();
        try {
          const parsed = JSON.parse(text);
          name = parsed.name || "";
          email = parsed.email || "";
        } catch {
          const params = new URLSearchParams(text);
          name = params.get("name") || "";
          email = params.get("email") || "";
        }
      }
    } catch (e) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload format." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const cleanName = (name && typeof name === "string") ? name.trim() : "Developer";
    const cleanEmail = email.trim().toLowerCase();
    const timestamp = new Date().toISOString();
    const userAgent = req.headers.get("user-agent") || "unknown";

    ensureFilesExist();

    // Read existing JSON list to prevent duplicate emails
    const rawJson = fs.readFileSync(JSON_FILE, "utf-8");
    let list: Array<{ timestamp: string; name: string; email: string; userAgent: string }> = [];
    try {
      list = JSON.parse(rawJson);
    } catch {
      list = [];
    }

    const alreadyExists = list.some((item) => item.email === cleanEmail);
    if (alreadyExists) {
      return NextResponse.json({
        success: true,
        alreadyJoined: true,
        message: "You're already on the priority waitlist! We'll notify you soon.",
        position: list.findIndex((item) => item.email === cleanEmail) + 1420,
      });
    }

    const newEntry = { timestamp, name: cleanName, email: cleanEmail, userAgent };
    list.push(newEntry);

    // Save JSON spreadsheet
    fs.writeFileSync(JSON_FILE, JSON.stringify(list, null, 2), "utf-8");

    // Append to CSV spreadsheet
    const csvRow = `"${timestamp}","${cleanName.replace(/"/g, '""')}","${cleanEmail}","${userAgent.replace(/"/g, '""')}"\n`;
    fs.appendFileSync(CSV_FILE, csvRow, "utf-8");

    const totalCount = 1420 + list.length;

    return NextResponse.json({
      success: true,
      message: "🎉 You're on the early access waitlist!",
      position: totalCount,
      totalCount,
    });
  } catch (error) {
    console.error("Error saving waitlist submission:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record submission. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    ensureFilesExist();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    if (format === "csv") {
      const csvData = fs.readFileSync(CSV_FILE, "utf-8");
      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="postcompass-waitlist.csv"',
        },
      });
    }

    const rawJson = fs.readFileSync(JSON_FILE, "utf-8");
    const list = JSON.parse(rawJson);
    return NextResponse.json({
      success: true,
      count: list.length,
      totalWaitlist: 1420 + list.length,
      entries: list,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to read waitlist data." },
      { status: 500 }
    );
  }
}
