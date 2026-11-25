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

The Next.js GraphQL API on port `3000` delegates student operations to the Express [student-service](./student-service/) on port `3001` and teacher operations to the Express [teacher-service](./teacher-service/) on port `3002`. Student creation validates the teacher through teacher-service. Both services use PostgreSQL configured by `DATABASE_URL`; the Compose setup provides a local PostgreSQL database with demo data.

The [gateway project](./gateway/README.md) routes `/service-a/*`, `/student-service/*`, and `/teacher-service/*` through port `8080`. See the gateway README for the manual Postman failure exercise, the automated smoke test, and the architecture diagram.

## Automated testing dan monitoring

Fitur ini mengikuti arsitektur proyek: `student-service` mengelola student dan notifikasi RabbitMQ, sedangkan `teacher-service` menyediakan data teacher yang dipakai untuk validasi student. Keduanya memiliki `GET /health` yang memeriksa koneksi PostgreSQL. Tes menggunakan database dan publisher tiruan, jadi `npm test` tidak membutuhkan PostgreSQL atau RabbitMQ.

Jalankan unit test dari root:

```powershell
npm test
```

Untuk menjalankan juga tes integrasi terhadap stack Docker Compose, atur `COMPOSE_TEST=1` sebelum `npm test`. Tes ini menghentikan teacher-service, memastikan pembuatan student menghasilkan `503`, menyalakan service kembali, memastikan respons `201`, lalu menghapus data uji.

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

1. Link repo: [week4_GraphQL_Lita](https://github.com/Litaa2407/week4_GraphQL_Lita).
2. Dari root project, jalankan `docker compose up --build --detach --wait`, kemudian `docker compose ps`; ambil screenshot ketika semua service berstatus `healthy`.
3. Di PowerShell, jalankan `$env:COMPOSE_TEST = "1"; npm test`; ambil screenshot hasil test lulus terhadap stack Compose.
4. Untuk screenshot khusus latihan kegagalan dan pemulihan, gunakan `$env:COMPOSE_TEST = "1"; npm test -- --test-name-pattern="Compose mengembalikan"`. Output mencatat `503` saat `teacher-service` berhenti dan `201` sesudah dinyalakan kembali. Di proyek ini, `teacher-service` adalah service dependensi yang menggantikan peran `product-service` pada contoh tugas.
5. Workflow [CI berbasis Compose](./.github/workflows/ci.yml) membangun dan menunggu semua service sehat, lalu menjalankan `npm test` termasuk tes pemulihan tersebut. Setelah perubahan ini masuk ke `main`, ambil link run hijau pada tab [Actions](https://github.com/Litaa2407/week4_GraphQL_Lita/actions?query=branch%3Amain).

Untuk menghentikan stack setelah demo, jalankan `docker compose down`. Data PostgreSQL lokal tetap disimpan di volume Compose; untuk menghapus data demo juga, gunakan `docker compose down --volumes`.

### Menjalankan seluruh sistem dengan Compose

Setiap komponen aplikasi, kedua service data, dan gateway dibuat dari Dockerfile masing-masing. PostgreSQL diinisialisasi dengan schema serta data demo oleh [database/init.sql](./database/init.sql); RabbitMQ menjalankan antrean event, worker email, dan gRPC service juga disertakan.

```powershell
docker compose up --build --detach --wait
docker compose ps
```

URL lokal: Next.js `http://localhost:3000`, student-service `http://localhost:3001`, teacher-service `http://localhost:3002`, gateway `http://localhost:8080`, RabbitMQ Management `http://localhost:15672` (login demo `guest` / `guest`), dan gRPC `localhost:50051`. Credential PostgreSQL di Compose hanya untuk penggunaan lokal; ganti konfigurasi sebelum deployment selain lokal. `DATABASE_SSL=false` hanya menonaktifkan TLS untuk PostgreSQL lokal, sedangkan konfigurasi default service tetap memakai SSL untuk database eksternal.

Untuk menghasilkan screenshot yang menunjukkan test integrasi serta skenario `503` → `201`:

```powershell
$env:COMPOSE_TEST = "1"
npm test
```

Tes integrasi otomatis berhenti dan menyalakan kembali `teacher-service` lewat Docker Compose, lalu membersihkan student yang dibuat. Ia memerlukan stack yang sudah sehat. Hapus pengaturan mode setelah demo dengan `Remove-Item Env:COMPOSE_TEST`.

### Ringkasan implementasi untuk laporan

Sistem GraphQL ini menggunakan dua microservice Express untuk data utama. `student-service` berjalan di port 3001 dan menangani data student, sedangkan `teacher-service` berjalan di port 3002 dan menyediakan data teacher. Saat student dibuat, `student-service` meminta validasi teacher kepada `teacher-service` menggunakan `teacher_id`. Jika teacher ditemukan, data student disimpan dan event notifikasi diterbitkan ke RabbitMQ. Log kedua service mencatat ID teacher yang sama sehingga alur komunikasi antarlayanan dapat diverifikasi.

Kedua service menyediakan endpoint `GET /health`. Endpoint tersebut menjalankan query `SELECT 1` untuk memastikan database dapat dijangkau, lalu mengembalikan status service dalam format JSON. `monitor.js` memeriksa endpoint kesehatan student-service dan teacher-service secara berkala. Perubahan dari kondisi sehat menjadi tidak sehat dicatat sebagai `ALERT`, sedangkan layanan yang pulih dicatat sebagai `RECOVERED`.

Pengujian otomatis student-service mencakup jalur sukses membaca student, jalur error untuk ID student yang tidak valid, serta efek pembuatan student yang menerbitkan event setelah data tersimpan. Pengujian teacher-service mencakup jalur sukses membaca daftar teacher, jalur error ketika teacher tidak ditemukan, dan pemeriksaan bahwa health check benar-benar melakukan query ke database. Teacher-service saat ini hanya menyediakan operasi baca, sehingga pengujian efeknya memverifikasi interaksi health check dengan dependency database, bukan perubahan data.

Workflow GitHub Actions pada `.github/workflows/ci.yml` dipicu oleh push ke `main` atau `uji-gagal`, dan pull request menuju `main`. Workflow membangun dan menunggu stack Compose sehat, menjalankan unit test serta skenario integrasi 503→201, lalu menjalankan linter. Unit test memakai dependency tiruan dan dapat dijalankan tanpa PostgreSQL maupun RabbitMQ; tes integrasi menggunakan service Compose.

### Refleksi

- **(a)** Tes otomatis hanya memeriksa jalur yang sudah ditentukan dengan dependency tiruan, sehingga belum tentu menangkap masalah integrasi nyata seperti jaringan lambat, konfigurasi database keliru, RabbitMQ tidak tersedia, atau beban bersamaan.
- **(b)** ID permintaan (*correlation ID*) penting untuk menelusuri satu request melewati GraphQL dan beberapa service, sedangkan log yang hanya tampil di terminal sulit dicari, tidak terpusat, dan dapat hilang ketika proses atau terminal ditutup.
- **(c)** Jika `/health` selalu menjawab `ok` tanpa memeriksa database atau service yang dibutuhkan, monitor bisa memberi status sehat palsu sementara operasi sebenarnya gagal.
- **(d)** Konfigurasi lokal dan CI dapat berbeda, misalnya port yang sudah dipakai atau variabel `.env` lokal. Compose mengurangi perbedaan dengan membangun semua komponen dan memakai database serta konfigurasi demo yang sama di laptop maupun CI.

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

For the failure exercise against the Compose stack, use the `COMPOSE_TEST=1` instructions above. The separate `node .\smoke-test.js` script remains available for a local setup with Next.js, PostgreSQL, and its own service processes.

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
