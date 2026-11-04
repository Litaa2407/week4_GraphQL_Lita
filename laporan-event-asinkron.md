# Laporan Pengujian Event Asinkron

**Mata kuliah:** Praktikum Web Service  
**Nama:** ........................................................  
**NIM:** ........................................................  
**Tanggal pengujian:** 4 November 2026

## Tujuan

Menerapkan komunikasi asinkron untuk notifikasi saat data student dibuat, lalu mengamati perilaku antrean ketika consumer tidak aktif dan ketika consumer berhenti sebelum mengakui pesan.

## Rancangan

Interaksi notifikasi student dibuat menggunakan RabbitMQ. Setelah record student berhasil dibuat, `student-service` mengirim event ke antrean `student.created`. `email-service` mengambil pesan dari antrean dan mengirim ACK setelah simulasi notifikasi dicatat.

| Elemen | Keterangan |
|---|---|
| Nama event | `student.created.v1` |
| Isi pesan | `eventId`, `eventType`, `occurredAt`, serta `data` berisi `studentId`, `nama`, `teacherId`, dan `recipient` |
| Producer | `student-service` |
| Consumer | `email-service` (`email-service/consumer.js`) |
| Broker dan antrean | RabbitMQ, `student.created` |
| Alasan dibuat asinkron | Notifikasi tidak perlu menahan respons utama pembuatan student. RabbitMQ dapat menyimpan pesan sampai consumer siap memprosesnya. |

## Hasil Pengujian

### 1. Consumer tidak aktif: antrean Ready = 3

Tiga event demo diterbitkan ketika consumer belum dijalankan. Dashboard RabbitMQ menunjukkan tiga pesan berstatus **Ready** dan belum ada pesan **Unacked**.

![Dashboard RabbitMQ menunjukkan Ready = 3](./laporan-asinkron-assets/01-rabbitmq-ready-3.png)

### 2. Consumer dijalankan kembali

Consumer normal dijalankan. Ketiga pesan diproses dan setiap pesan mendapat ACK, sehingga pesan dapat dikeluarkan dari antrean.

![Log consumer memproses dan meng-ACK tiga pesan](./laporan-asinkron-assets/02-consumer-ack.png)

### 3. Consumer crash sebelum ACK

Satu event diterbitkan. Consumer mode `--crash` mencatat simulasi email, lalu berhenti sebelum mengirim ACK. Ketika consumer normal dijalankan kembali, RabbitMQ mengirim pesan yang sama lagi. Kedua baris `EMAIL_SENT` memiliki `eventId` yang sama, membuktikan pengiriman ulang.

![Log crash dan pengiriman ulang dengan eventId yang sama](./laporan-asinkron-assets/03-crash-redelivery.png)

### 4. Diagram arsitektur yang diperbarui

![Diagram arsitektur aplikasi dengan alur event RabbitMQ](./laporan-asinkron-assets/04-architecture.png)

## Kesimpulan

Antrean RabbitMQ menahan event saat consumer tidak aktif dan mengirim ulang pesan ketika consumer berhenti sebelum ACK. Pola ini menunjukkan **at-least-once delivery**: pesan yang sama dapat diproses lebih dari sekali. Karena itu, consumer produksi sebaiknya idempoten, misalnya dengan mencatat `eventId` yang sudah diproses agar retry tidak menimbulkan notifikasi ganda.

**Catatan:** `EMAIL_SENT` pada pengujian ini hanya simulasi melalui log. Aplikasi demo tidak mengirim email melalui SMTP.
