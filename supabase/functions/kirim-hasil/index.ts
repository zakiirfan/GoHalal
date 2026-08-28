// Mengirim PDF hasil Halal Readiness Check ke email pengunjung.
//
// Deploy:  supabase functions deploy kirim-hasil --no-verify-jwt
// Secret:  supabase secrets set RESEND_API_KEY=re_xxx EMAIL_PENGIRIM="GoHalal <hasil@domainanda.com>"
//
// --no-verify-jwt dipakai karena yang memanggil adalah pengunjung anonim dari
// halaman publik, bukan user yang login.

const ASAL_DIIZINKAN = [
  "https://zakiirfan.github.io",
  "http://localhost:8000",
];

const BATAS_PDF = 5 * 1024 * 1024; // 5MB

function corsHeaders(origin: string | null) {
  const asal = origin && ASAL_DIIZINKAN.includes(origin) ? origin : ASAL_DIIZINKAN[0];
  return {
    "Access-Control-Allow-Origin": asal,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function emailValid(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

// Batasi panjang teks yang masuk ke badan email supaya isian yang aneh-aneh
// tidak bisa membengkakkan pesan.
function bersih(v: unknown, maks = 120): string {
  return typeof v === "string" ? v.slice(0, maks).replace(/[<>]/g, "") : "";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const KUNCI = Deno.env.get("RESEND_API_KEY");
  const PENGIRIM = Deno.env.get("EMAIL_PENGIRIM");
  if (!KUNCI || !PENGIRIM) {
    console.error("RESEND_API_KEY atau EMAIL_PENGIRIM belum di-set");
    return new Response(JSON.stringify({ error: "Server belum dikonfigurasi" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body bukan JSON" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!emailValid(body.email)) {
    return new Response(JSON.stringify({ error: "Email tidak valid" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const pdf = body.pdfBase64;
  if (typeof pdf !== "string" || pdf.length < 100 || pdf.length > BATAS_PDF) {
    return new Response(JSON.stringify({ error: "PDF tidak valid" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const nama = bersih(body.nama) || "Bapak/Ibu";
  const namaUsaha = bersih(body.namaUsaha);
  const skor = Number(body.skor);
  const kategori = bersih(body.kategori, 40);
  const layanan = bersih(body.layanan, 80);
  const namaFile = bersih(body.namaFile, 80).replace(/[^\w.-]/g, "") || "hasil.pdf";

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a2a24">
  <div style="background:#12463b;padding:28px 30px;border-radius:12px 12px 0 0">
    <div style="color:#fffdf7;font-size:20px;font-weight:800">GoHalal</div>
    <div style="color:#d4af6a;font-size:13px;margin-top:4px">Hasil Halal Readiness Check</div>
  </div>
  <div style="border:1px solid #e3dcc8;border-top:none;border-radius:0 0 12px 12px;padding:28px 30px">
    <p style="margin:0 0 16px;font-size:15px">Halo ${nama},</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#5a5a4f">
      Terima kasih sudah menyelesaikan Halal Readiness Check. Hasil lengkap
      ${namaUsaha ? `untuk <strong>${namaUsaha}</strong> ` : ""}kami lampirkan dalam bentuk PDF di email ini.
    </p>
    <div style="background:#faf6ec;border-radius:10px;padding:20px 22px;margin-bottom:20px">
      <div style="font-size:32px;font-weight:800;color:#12463b;line-height:1">
        ${Number.isFinite(skor) ? skor : "-"}<span style="font-size:14px;font-weight:400;color:#5a5a4f"> / 100</span>
      </div>
      ${kategori ? `<div style="font-size:13px;font-weight:700;color:#9a7628;margin-top:6px">${kategori}</div>` : ""}
      ${layanan ? `<div style="font-size:13px;color:#5a5a4f;margin-top:10px">Langkah yang kami sarankan: <strong style="color:#12463b">${layanan}</strong></div>` : ""}
    </div>
    <p style="margin:0 0 6px;font-size:14px;line-height:1.65;color:#5a5a4f">
      Kalau mau membahas hasilnya, balas email ini atau hubungi kami di WhatsApp
      <a href="https://wa.me/6287712644343" style="color:#12463b;font-weight:700">0877-1264-4343</a>.
      Ngobrol dulu, bukan langsung ditawari.
    </p>
    <p style="margin:22px 0 0;font-size:11px;line-height:1.6;color:#8c8c80;border-top:1px solid #e3dcc8;padding-top:16px">
      Halal Readiness Score adalah hasil self-assessment berdasarkan informasi yang Anda berikan:
      bukan audit, bukan penetapan status halal, bukan fatwa, dan bukan jaminan sertifikasi.
      Proses resmi tetap mengikuti ketentuan BPJPH/LPH yang berlaku.
    </p>
  </div>
</div>`.trim();

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KUNCI}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: PENGIRIM,
      to: [body.email],
      subject: `Hasil Halal Readiness Check${namaUsaha ? ` - ${namaUsaha}` : ""}`,
      html,
      attachments: [{ filename: namaFile, content: pdf }],
    }),
  });

  if (!resp.ok) {
    // Isi error dari penyedia email tidak diteruskan ke browser.
    console.error("Resend gagal:", resp.status, await resp.text());
    return new Response(JSON.stringify({ error: "Gagal mengirim email" }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
