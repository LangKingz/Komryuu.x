/* eslint-disable prefer-const */
import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addDoc } from "firebase/firestore";

import { extensiType } from "@/model/extensi";

function generateSimpleId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const limit = searchParams.get("limit");
  try {
    const extensiCol = collection(db, "EXTENSION");
    const extensiSnapshot = await getDocs(extensiCol);
    let extensiList: extensiType[] = extensiSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        logo: data.logo,
        type: data.type,
        BaseUrl: data.BaseUrl,
        UrlSearch: data.UrlSearch,
        location: data.location,
        createdAt: data.createdAt,
      };
    });

    if (type) {
      extensiList = extensiList.filter((extensi) => extensi.type === type);
    }

    if (limit) {
      const limitNumber = parseInt(limit, 10);
      extensiList = extensiList.slice(0, limitNumber);
    }

    return NextResponse.json({
      success: true,
      total: extensiList.length,
      authenticated: {
        admin: true,
      },
      message: "Success, data retrieved",
      data: extensiList,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let { name, description = "", logo, type, url, Urlsearch = "", location, api = "" } = body;

    if (!name || !logo || !type || !url) {
      return NextResponse.json({ success: false, error: "All fields are required" }, { status: 400 });
    }

    const typeExtensi = ["komik", "anime", "cinema"];
    if (!typeExtensi.includes(type)) {
      return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
    }

    if (!description) {
      description = "No description available";
    }

    if (!Urlsearch) {
      Urlsearch = "UrlSearch not provided";
    }

    if (!api) {
      api = "API not provided";
    }

    const newData = {
      id: generateSimpleId(), // generate a random ID
      name: name,
      location: location,
      description: description,
      logo: logo,
      type: type,
      BaseUrl: url,
      api, // Assuming BaseUrl is the same as url
      UrlSearch: Urlsearch || "",
      createdAt: new Date().toISOString(), // menambah field waktu
    };

    const extensiCol = collection(db, "EXTENSION");
    const docRef = await addDoc(extensiCol, newData);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      data: newData,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error }, { status: 500 });
  }
}
