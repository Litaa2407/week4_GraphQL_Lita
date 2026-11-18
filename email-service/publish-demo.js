const amqp = require("amqplib");
const { randomUUID } = require("node:crypto");

const queueName = "student.created";
const countArgument = process.argv.find((argument) =>
  argument.startsWith("--count=")
);
const count = countArgument ? Number(countArgument.split("=")[1]) : 3;

async function publishDemoEvents() {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("--count harus berupa bilangan bulat antara 1 dan 100");
  }

  const connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672"
  );

  try {
    const channel = await connection.createConfirmChannel();
    await channel.assertQueue(queueName, { durable: true });

    for (let index = 1; index <= count; index += 1) {
      const event = {
        eventId: randomUUID(),
        eventType: "student.created.v1",
        occurredAt: new Date().toISOString(),
        data: {
          studentId: `demo-${Date.now()}-${index}`,
          nama: `Student Demo ${index}`,
          teacherId: 1,
          recipient:
            process.env.NOTIFICATION_EMAIL_TO || "student@example.test",
        },
      };

      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(event)), {
        contentType: "application/json",
        persistent: true,
      });
      console.log(`PUBLISHED eventId=${event.eventId}`);
    }

    await channel.waitForConfirms();
    await channel.close();
  } finally {
    await connection.close();
  }
}

publishDemoEvents().catch((error) => {
  console.error("Gagal menerbitkan event demo:", error);
  process.exitCode = 1;
});
