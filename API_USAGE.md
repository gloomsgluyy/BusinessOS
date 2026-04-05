# Dokumentasi Penggunaan API MOM Service

Dokumen ini menjelaskan cara memakai API Minutes of Meeting (MOM) Service dari sisi client.

## Base URL

Untuk pengembangan lokal:

```text
http://localhost:8080
```

Prefix endpoint versi API:

```text
/api/v1
```

## Alur Singkat Pemakaian

1. Upload video meeting ke endpoint upload.
2. Simpan nilai job_id dari response.
3. Poll endpoint status job sampai status completed atau failed.
4. Jika completed, ambil pdf_url dari hasil untuk download PDF MOM.

## Endpoint

### 1) Health Check

Memastikan service hidup dan mengecek ketersediaan FFmpeg.

- Method: GET
- URL: /api/v1/health

Contoh request:

```bash
curl http://localhost:8080/api/v1/health
```

Contoh response:

```json
{
  "status": "ok",
  "ffmpeg_status": true,
  "timestamp": 1775352900
}
```

Jika FFmpeg tidak tersedia, status tetap HTTP 200 tetapi nilai status menjadi degraded.

```json
{
  "status": "degraded",
  "ffmpeg_status": false,
  "timestamp": 1775352900,
  "warning": "FFmpeg not available"
}
```

### 2) Upload Video

Mengunggah video meeting dan memulai proses async di background.

- Method: POST
- URL: /api/v1/mom/upload-video
- Content-Type: multipart/form-data
- Form field wajib: video

Format file yang didukung:

- .mp4
- .mov
- .avi
- .mkv
- .webm

Contoh request:

```bash
curl -X POST http://localhost:8080/api/v1/mom/upload-video \
  -F "video=@C:/path/to/meeting.mp4"
```

Contoh response sukses (HTTP 201):

```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Video uploaded successfully. Processing started."
}
```

Contoh response error (HTTP 400):

```json
{
  "success": false,
  "error": "video file is required"
}
```

### 3) Cek Status Job

Mengambil status proses video berdasarkan job_id.

- Method: GET
- URL: /api/v1/mom/jobs/{id}

Contoh request:

```bash
curl http://localhost:8080/api/v1/mom/jobs/550e8400-e29b-41d4-a716-446655440000
```

Contoh response saat masih proses (HTTP 200):

```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "video_file_name": "1743822000_ab12cd34.mp4",
    "video_file_path": "uploads/1743822000_ab12cd34.mp4",
    "audio_file_path": "uploads/1743822000_ab12cd34.mp3",
    "status": "transcribing",
    "progress": 40,
    "created_at": "2026-04-05T03:30:00Z",
    "updated_at": "2026-04-05T03:31:00Z"
  }
}
```

Contoh response saat selesai (HTTP 200):

```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "video_file_name": "1743822000_ab12cd34.mp4",
    "video_file_path": "uploads/1743822000_ab12cd34.mp4",
    "audio_file_path": "uploads/1743822000_ab12cd34.mp3",
    "status": "completed",
    "progress": 100,
    "result": {
      "transcription": "Ringkasan transkrip meeting...",
      "mom_markdown": "# Minutes of Meeting\n\n## Ringkasan\n...",
      "extracted_tasks": [
        {
          "title": "Finalisasi proposal",
          "assignee_hint": "Budi",
          "due_date_hint": "Jumat",
          "priority": "high",
          "description": "Lengkapi bagian anggaran"
        }
      ],
      "pdf_file_name": "mom_550e8400-e29b-41d4-a716-446655440000_1743822100.pdf",
      "pdf_file_path": "uploads/mom_550e8400-e29b-41d4-a716-446655440000_1743822100.pdf",
      "pdf_url": "http://localhost:8080/api/v1/mom/pdf/mom_550e8400-e29b-41d4-a716-446655440000_1743822100.pdf"
    },
    "created_at": "2026-04-05T03:30:00Z",
    "updated_at": "2026-04-05T03:35:00Z",
    "completed_at": "2026-04-05T03:35:00Z"
  }
}
```

Contoh response saat gagal (HTTP 200, status job failed):

```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "failed",
    "progress": 0,
    "error": "transcription failed: groq API error (status 401): Invalid API key"
  }
}
```

Catatan penting:

- Kegagalan proses biasanya ditandai lewat field job.status = failed, bukan status HTTP non-200 pada endpoint cek status.

### 4) Download PDF

Mengunduh file PDF hasil MOM.

- Method: GET
- URL: /api/v1/mom/pdf/{filename}

Contoh request:

```bash
curl -L -o hasil-mom.pdf \
  http://localhost:8080/api/v1/mom/pdf/mom_550e8400-e29b-41d4-a716-446655440000_1743822100.pdf
```

Header response menyertakan:

- Content-Type: application/pdf
- Content-Disposition: attachment; filename=<filename>

## Daftar Status Proses Job

Urutan status normal:

```text
pending -> extracting_audio -> transcribing -> generating_mom -> creating_pdf -> completed
```

Status error:

```text
failed
```

Makna progress:

- 0: Baru dibuat atau gagal.
- 10: Sedang ekstrak audio.
- 40: Sedang transkripsi.
- 60: Sedang generate MOM.
- 80: Sedang membuat PDF.
- 100: Selesai.

## Panduan Polling di Frontend

Contoh JavaScript sederhana:

```javascript
async function uploadVideo(file) {
  const formData = new FormData();
  formData.append("video", file);

  const res = await fetch("http://localhost:8080/api/v1/mom/upload-video", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload gagal: ${res.status}`);
  }

  const data = await res.json();
  return data.job_id;
}

async function getJob(jobId) {
  const res = await fetch(`http://localhost:8080/api/v1/mom/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`Gagal cek status: ${res.status}`);
  }
  const data = await res.json();
  return data.job;
}

async function processMeeting(file) {
  const jobId = await uploadVideo(file);

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const job = await getJob(jobId);

        if (job.status === "completed") {
          clearInterval(interval);
          resolve(job.result);
          return;
        }

        if (job.status === "failed") {
          clearInterval(interval);
          reject(new Error(job.error || "Proses gagal"));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 3000);
  });
}
```

## Error Umum

Format error response dari endpoint yang memvalidasi input:

```json
{
  "success": false,
  "error": "pesan error"
}
```

Pesan yang sering muncul:

- file too large or invalid form
- video file is required
- unsupported video format. Allowed: mp4, mov, avi, mkv, webm
- job not found
- filename is required
- invalid filename
- file not found

## Konfigurasi yang Berpengaruh ke API

Variabel environment penting:

- PORT: port service, default 8080.
- ALLOWED_ORIGINS: daftar origin CORS dipisahkan koma.
- GROQ_API_KEY: wajib, tanpa ini service tidak bisa start.
- UPLOAD_DIR: lokasi penyimpanan video/audio/pdf.
- MAX_VIDEO_SIZE_MB: batas ukuran upload video.

## Checklist Integrasi

1. Pastikan endpoint health menghasilkan status ok atau degraded.
2. Upload file dengan field video pada multipart/form-data.
3. Simpan job_id ke state atau database aplikasi.
4. Poll endpoint job sampai completed atau failed.
5. Tampilkan mom_markdown, transcription, dan extracted_tasks ke UI.
6. Gunakan pdf_url untuk tombol download hasil MOM.
