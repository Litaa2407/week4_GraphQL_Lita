const amqp = require("amqplib");

const queueName = "student.created";
const crashAfterSend = process.argv.includes("--crash");
const rabbitmqUrl =
  process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

async function start() {
  const connection = await amqp.connect(rabbitmqUrl);
  const channel = await connection.createChannel();

  await channel.assertQueue(queueName, { durable: true });
  await channel.prefetch(1);

  console.log(
    `Email consumer aktif; menunggu pesan di antrean "${queueName}"${crashAfterSend ? " (mode --crash)" : ""}`
  );

  await channel.consume(queueName, (message) => {
    if (!message) return;

    try {
      const event = JSON.parse(message.content.toString());
      if (
        event.eventType !== "student.created.v1" ||
        !event.data?.studentId ||
        !event.data?.recipient
      ) {
        throw new Error("Format event student.created.v1 tidak valid");
      }

      console.log(
        `EMAIL_SENT to=${event.data.recipient} studentId=${event.data.studentId} eventId=${event.eventId} nama=${JSON.stringify(event.data.nama)}`
      );
      console.log("Email di atas adalah simulasi melalui log, bukan pengiriman SMTP.");

      if (crashAfterSend) {
        console.error("SIMULATED_CRASH: proses berhenti sebelum ACK; pesan akan dikirim ulang.");
        process.exit(1);
      }

      channel.ack(message);
      console.log(`ACK eventId=${event.eventId}`);
    } catch (error) {
      console.error("Gagal memproses event; pesan ditolak tanpa retry:", error);
      channel.nack(message, false, false);
    }
  });
}

start().catch((error) => {
  console.error("Email consumer gagal dijalankan:", error);
  process.exitCode = 1;
});
