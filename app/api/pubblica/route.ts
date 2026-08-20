import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

/**
 * Proxy verso il servizio di pubblicazione.
 *
 * Il browser non parla mai direttamente col servizio: il suo token vive qui,
 * lato server, e chi carica deve avere una sessione OpenReply valida. Il corpo
 * della richiesta viene inoltrato come stream — un reel pesa decine di MB e
 * bufferizzarlo con formData() lo terrebbe tutto in memoria.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function servizio() {
  const base = process.env.POSTER_URL?.replace(/\/$/, "");
  const token = process.env.POSTER_TOKEN;
  return base && token ? { base, token } : null;
}

export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const config = servizio();
  if (!config) {
    return NextResponse.json(
      { success: false, error: "POSTER_URL o POSTER_TOKEN non configurati" },
      { status: 503 }
    );
  }

  try {
    const risposta = await fetch(`${config.base}/publish`, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "",
        "X-Poster-Token": config.token,
      },
      body: request.body,
      // richiesto da Node quando il corpo è uno stream
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const testo = await risposta.text();
    return new NextResponse(testo, {
      status: risposta.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[pubblica] invio al servizio fallito", err);
    return NextResponse.json(
      { success: false, error: "Servizio di pubblicazione non raggiungibile" },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const config = servizio();
  if (!config) {
    return NextResponse.json(
      { success: false, error: "POSTER_URL o POSTER_TOKEN non configurati" },
      { status: 503 }
    );
  }

  const job = request.nextUrl.searchParams.get("job");
  if (!job) {
    return NextResponse.json(
      { success: false, error: "Manca l'id del job" },
      { status: 400 }
    );
  }

  try {
    const risposta = await fetch(
      `${config.base}/jobs/${encodeURIComponent(job)}`,
      { headers: { "X-Poster-Token": config.token }, cache: "no-store" }
    );
    const testo = await risposta.text();
    return new NextResponse(testo, {
      status: risposta.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[pubblica] lettura job fallita", err);
    return NextResponse.json(
      { success: false, error: "Servizio di pubblicazione non raggiungibile" },
      { status: 502 }
    );
  }
}
