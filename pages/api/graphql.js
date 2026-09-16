const { ApolloServer } = require("@apollo/server");
const {
  startServerAndCreateNextHandler,
} = require("@as-integrations/next");
const {
  ApolloServerPluginLandingPageLocalDefault,
} = require("@apollo/server/plugin/landingPage/default");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Counter untuk membuktikan N+1 Problem
let teacherResolverCallCount = 0;

const typeDefs = `#graphql
  type Student {
    id: ID!
    nama: String!
    umur: Int!
    tanggal: String!
    teacher_id: Int!
  }

  type Teacher {
    id: ID!
    nama: String!
    umur: Int!
    tanggal: String!
    students: [Student!]!
  }

  type Staff {
    id: ID!
    nama: String!
    umur: Int!
    tanggal: String!
  }

  type Query {
    students: [Student!]!
    teachers: [Teacher!]!
    staff: [Staff!]!

    student(id: ID!): Student
    teacher(id: ID!): Teacher
    staffMember(id: ID!): Staff
  }

  type Mutation {
    createStudent(
      nama: String!
      umur: Int!
      tanggal: String!
      teacher_id: Int!
    ): Student

    updateStudent(
      id: ID!
      nama: String!
      umur: Int!
      tanggal: String!
      teacher_id: Int!
    ): Student

    deleteStudent(id: ID!): Student
  }
`;

const resolvers = {
  // ==========================================
  // QUERY
  // ==========================================
  Query: {
    students: async () => {
      const result = await pool.query(
        "SELECT * FROM students ORDER BY id"
      );

      return result.rows.map((student) => ({
        ...student,
        tanggal: student.tanggal.toISOString().split("T")[0],
      }));
    },

    teachers: async () => {
      teacherResolverCallCount = 0;

      const result = await pool.query(
        "SELECT * FROM teachers ORDER BY id"
      );

      console.log("Query.teachers dipanggil: 1 kali");

      return result.rows.map((teacher) => ({
        ...teacher,
        tanggal: teacher.tanggal.toISOString().split("T")[0],
      }));
    },

    staff: async () => {
      const result = await pool.query(
        "SELECT * FROM staff ORDER BY id"
      );

      return result.rows.map((staff) => ({
        ...staff,
        tanggal: staff.tanggal.toISOString().split("T")[0],
      }));
    },

    student: async (_, { id }) => {
      const result = await pool.query(
        "SELECT * FROM students WHERE id = $1",
        [id]
      );

      const student = result.rows[0];

      if (!student) return null;

      return {
        ...student,
        tanggal: student.tanggal.toISOString().split("T")[0],
      };
    },

    teacher: async (_, { id }) => {
      const result = await pool.query(
        "SELECT * FROM teachers WHERE id = $1",
        [id]
      );

      const teacher = result.rows[0];

      if (!teacher) return null;

      return {
        ...teacher,
        tanggal: teacher.tanggal.toISOString().split("T")[0],
      };
    },

    staffMember: async (_, { id }) => {
      const result = await pool.query(
        "SELECT * FROM staff WHERE id = $1",
        [id]
      );

      const staff = result.rows[0];

      if (!staff) return null;

      return {
        ...staff,
        tanggal: staff.tanggal.toISOString().split("T")[0],
      };
    },
  },

  // ==========================================
  // RELATION: TEACHER -> STUDENTS
  // ==========================================
  Teacher: {
    students: async (teacher) => {
      teacherResolverCallCount++;

      console.log(
        `Teacher.students resolver dipanggil: ${teacherResolverCallCount} kali`
      );

      const result = await pool.query(
        `SELECT * FROM students
         WHERE teacher_id = $1
         ORDER BY id`,
        [teacher.id]
      );

      return result.rows.map((student) => ({
        ...student,
        tanggal: student.tanggal.toISOString().split("T")[0],
      }));
    },
  },

  // ==========================================
  // MUTATION
  // ==========================================
  Mutation: {

    // ==========================================
    // CREATE STUDENT
    // ==========================================
    createStudent: async (_, { nama, umur, tanggal, teacher_id }) => {

      // Cek teacher
      const teacherCheck = await pool.query(
        "SELECT id FROM teachers WHERE id = $1",
        [teacher_id]
      );

      if (teacherCheck.rows.length === 0) {
        throw new Error("Teacher tidak ditemukan");
      }

      const result = await pool.query(
        `INSERT INTO students
          (nama, umur, tanggal, teacher_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [nama, umur, tanggal, teacher_id]
      );

      const student = result.rows[0];

      return {
        ...student,
        tanggal: student.tanggal.toISOString().split("T")[0],
      };
    },

    // ==========================================
    // UPDATE STUDENT
    // ==========================================
    updateStudent: async (
      _,
      { id, nama, umur, tanggal, teacher_id }
    ) => {

      // Cek teacher
      const teacherCheck = await pool.query(
        "SELECT id FROM teachers WHERE id = $1",
        [teacher_id]
      );

      if (teacherCheck.rows.length === 0) {
        throw new Error("Teacher tidak ditemukan");
      }

      const result = await pool.query(
        `UPDATE students
         SET
           nama = $1,
           umur = $2,
           tanggal = $3,
           teacher_id = $4
         WHERE id = $5
         RETURNING *`,
        [nama, umur, tanggal, teacher_id, id]
      );

      const student = result.rows[0];

      if (!student) {
        throw new Error("Student tidak ditemukan");
      }

      return {
        ...student,
        tanggal: student.tanggal.toISOString().split("T")[0],
      };
    },

    // ==========================================
    // DELETE STUDENT
    // ==========================================
    deleteStudent: async (_, { id }) => {

      const result = await pool.query(
        `DELETE FROM students
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      const student = result.rows[0];

      if (!student) {
        throw new Error("Student tidak ditemukan");
      }

      return {
        ...student,
        tanggal: student.tanggal.toISOString().split("T")[0],
      };
    },
  },
};

// ==========================================
// APOLLO SERVER
// ==========================================
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  plugins: [
    ApolloServerPluginLandingPageLocalDefault(),
  ],
});

// ==========================================
// NEXT.JS HANDLER
// ==========================================
const handler = startServerAndCreateNextHandler(server);

module.exports = handler;