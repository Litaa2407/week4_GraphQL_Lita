[![CI](https://github.com/Litaa2407/week4_GraphQL_Lita/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Litaa2407/week4_GraphQL_Lita/actions/workflows/ci.yml)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## GraphQL API and microservices

The Next.js GraphQL API on port `3000` delegates student operations to the Express [student-service](./student-service/) on port `3001` and teacher operations to the Express [teacher-service](./teacher-service/) on port `3002`. Student creation validates the teacher through teacher-service. Both services currently use the existing PostgreSQL database configured by `DATABASE_URL`; student-service owns student operations and teacher-service owns teacher reads.

The [gateway project](./gateway/README.md) routes `/service-a/*`, `/student-service/*`, and `/teacher-service/*` through port `8080`. See the gateway README for the manual Postman failure exercise, the automated smoke test, and the architecture diagram.

## Automated testing dan monitoring

Fitur ini mengikuti arsitektur proyek: `student-service` mengelola student dan notifikasi RabbitMQ, sedangkan `teacher-service` menyediakan data teacher yang dipakai untuk validasi student. Keduanya memiliki `GET /health` yang memeriksa koneksi PostgreSQL. Tes menggunakan database dan publisher tiruan, jadi `npm test` tidak membutuhkan PostgreSQL atau RabbitMQ.

Jalankan semua tes dari root:

```powershell
npm test
```

Tes per service dan kontrak gateway juga dapat dijalankan sendiri:

```powershell
Set-Location .\student-service
npm test
Set-Location ..\teacher-service
npm test
Set-Location ..\gateway
npm run test:openapi-contract
```

Tes student mencakup jalur sukses, validasi input gagal, dan efek samping publikasi event setelah penyimpanan. Tes teacher mencakup pembacaan data, teacher yang tidak ditemukan, dan probe database oleh health check (service ini memang hanya menyediakan operasi baca).

Jalankan monitor dari root ketika kedua service aktif:

```powershell
npm run monitor
```

Monitor mengecek `http://localhost:3001/health` dan `http://localhost:3002/health` tiap 5 detik. Untuk mengubah target sesuai komponen sistem kelompok, edit konstanta `TARGETS` di [monitor.js](./monitor.js). Untuk demo screenshot, hentikan teacher-service sementara (`Ctrl+C` pada terminal servicenya); monitor mencatat `[ALERT]`. Jalankan kembali `npm start` di folder `teacher-service`; status pulih akan tercatat sebagai `[RECOVERED]`. Log validasi student dan lookup teacher menampilkan `id` teacher yang sama untuk bukti komunikasi antarlayanan.

### Bukti tugas dan GitHub Actions

1. Jalankan `npm test` di terminal dan ambil screenshot hasil lulus.
2. Untuk bukti kegagalan langkah 03, ubah sementara ekspektasi status pada salah satu tes menjadi nilai yang salah, jalankan `npm test`, lalu screenshot hasil gagal. Kembalikan ekspektasi, jalankan lagi sampai lulus, dan screenshot hasil perbaikan. Jangan simpan perubahan uji yang sengaja salah.
3. Ambil potongan log `student-service` dan `teacher-service` yang menunjukkan `teacher_id`/`id` sama.
4. Jalankan monitor, hentikan lalu nyalakan kembali teacher-service, dan screenshot terminal yang menunjukkan `[ALERT]` serta `[RECOVERED]`.
5. Setelah perubahan di-push ke GitHub, buka halaman [Actions](https://github.com/Litaa2407/week4_GraphQL_Lita/actions) untuk screenshot run hijau di `main`. Untuk screenshot run merah, push kegagalan tes sementara ke branch `uji-gagal`; setelah screenshot diambil, perbaiki tes dan push perbaikannya. Repo ini sudah menjalankan workflow dari [.github/workflows/ci.yml](./.github/workflows/ci.yml).
6. Link repo: [week4_GraphQL_Lita](https://github.com/Litaa2407/week4_GraphQL_Lita). Badge CI di bagian atas README menunjuk ke workflow `main`.

OpenAPI/Swagger documentation for the student and teacher services is served at `http://localhost:8080/docs` when the gateway is running. The contract is [gateway/openapi.json](./gateway/openapi.json); see the [gateway README](./gateway/README.md#openapi-dan-swagger-ui) for the `409` Try it out and contract-drift verification steps.

### Event asinkron: notifikasi student dibuat

Saat student berhasil dibuat, student-service menerbitkan event persisten `student.created.v1` ke antrean RabbitMQ `student.created`. Consumer email memprosesnya secara terpisah dan mengakui pesan setelah simulasi pengiriman email. Pesan tetap menunggu jika consumer mati, sehingga pembuatan student tidak perlu menunggu pekerjaan notifikasi selesai.

| Elemen | Detail |
| --- | --- |
| Nama event | `student.created.v1` |
| Isi pesan | `eventId`, `eventType`, `occurredAt`, dan `data` berisi `studentId`, `nama`, `teacherId`, serta `recipient` |
| Producer | `student-service`, setelah record student berhasil dibuat |
| Consumer | `email-service` (`email-service/consumer.js`) |
| Alasan asinkron | Notifikasi bukan bagian dari respons utama pembuatan student; antrean menahan pesan saat consumer tidak tersedia dan memungkinkan pemrosesan terpisah. |

Jika RabbitMQ tidak tersedia saat event diterbitkan, endpoint mengembalikan `503` dan `student_id` karena record student sudah tersimpan. Periksa record tersebut sebelum mengulang request pembuatan.

#### Menjalankan dan mengambil bukti

Pastikan Docker Desktop berjalan. Dari root project:

```powershell
docker compose up -d
npm run email:publish-demo
```

`email:publish-demo` menerbitkan tiga event contoh tanpa memerlukan koneksi database. Jangan jalankan consumer dulu. Buka `http://localhost:15672` (login `guest` / `guest`), pilih **Queues and Streams** lalu `student.created`; ambil screenshot ketika **Ready = 3**.
Jika queue berisi pesan dari percobaan sebelumnya, gunakan **Purge messages** pada halaman queue sebelum menerbitkan tiga event agar angkanya tepat tiga.

Nyalakan consumer dengan `npm run email:consumer`. Ketiga pesan berpindah dari **Ready** ke **Unacked**, lalu diakui satu per satu. Ambil screenshot terminal setelah semua baris `EMAIL_SENT` dan `ACK` muncul. Log tersebut menyimulasikan email; tidak ada email SMTP yang benar-benar dikirim. Setelah verifikasi, hentikan consumer dengan `Ctrl+C`.

Untuk menunjukkan pengiriman dua kali akibat proses mati sebelum ACK, terbitkan satu event lalu jalankan consumer dalam mode crash:

```powershell
npm run email:publish-demo -- --count=1
npm run email:consumer:crash
```

Consumer mencatat `EMAIL_SENT`, lalu berhenti sebelum ACK. Mulai ulang consumer normal:

```powershell
npm run email:consumer
```

Event yang sama akan menghasilkan dua baris `EMAIL_SENT` dengan `eventId` yang sama, karena RabbitMQ mengirim ulang pesan yang belum di-ACK. Ambil screenshot terminal yang menampilkan kedua baris tersebut. Ini menunjukkan perilaku at-least-once; consumer email produksi perlu idempotensi berdasarkan `eventId` agar retry tidak mengirim email ganda.

Diagram arsitektur yang diperbarui tersedia di [diagram SVG](./gateway/architecture-diagram.svg) dan [dokumentasi arsitektur](./.github/modernize/assessment/engines/facts/architecture-diagram.md).

For the failure exercise, start Next.js with `npm run dev`, then run `node .\smoke-test.js` from the project root. The test starts the two data services and gateway, stops teacher-service, verifies student creation returns `503` while student listing remains `200`, then verifies creation returns `201` after teacher-service restarts. It removes the test student afterward.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:


You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.

## GitHub OAuth Login

Create a GitHub OAuth App and set its Authorization callback URL to:

```text
http://localhost:3000/api/auth/github/callback
```

Copy `.env.example` to `.env` and set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `JWT_SECRET` with at least 32 characters. Keep the client secret and JWT secret server-side; do not commit `.env`. Set `APP_URL` to the application's public origin when deploying, and register `${APP_URL}/api/auth/github/callback` as the OAuth callback URL.

The callback validates OAuth `state`, exchanges the authorization code on the server, fetches the GitHub profile, and issues an HTTP-only app JWT cookie. Use the cookie to maintain the web login; GraphQL operations require `Authorization: Bearer <JWT>`. Requests without a valid bearer token are rejected with `401 UNAUTHENTICATED`.
