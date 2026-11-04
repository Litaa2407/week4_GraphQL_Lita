const amqp = require("amqplib");
const { randomUUID } = require("node:crypto");

const queueName = "student.created";

async function publishStudentCreated(student) {
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672"
  );

  try {
    const channel = await connection.createConfirmChannel();
    await channel.assertQueue(queueName, { durable: true });

    const event = {
      eventId: randomUUID(),
      eventType: "student.created.v1",
      occurredAt: new Date().toISOString(),
      data: {
        studentId: student.id,
        nama: student.nama,
        teacherId: student.teacher_id,
        recipient:
          process.env.NOTIFICATION_EMAIL_TO || "student@example.test",
      },
    };

    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(event)), {
      contentType: "application/json",
      persistent: true,
    });
    await channel.waitForConfirms();
    await channel.close();
  } finally {
    await connection.close();
  }
}

module.exports = { publishStudentCreated };
