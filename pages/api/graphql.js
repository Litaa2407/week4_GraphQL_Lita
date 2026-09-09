const { ApolloServer } = require("@apollo/server");
const {
  startServerAndCreateNextHandler,
} = require("@as-integrations/next");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const typeDefs = `#graphql
  type Student {
    id: ID!
    nama: String!
    umur: Int!
    tanggal: String!
  }

  type Teacher {
    id: ID!
    nama: String!
    umur: Int!
    tanggal: String!
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
`;

const resolvers = {
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
      const result = await pool.query(
        "SELECT * FROM teachers ORDER BY id"
      );

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

      return result.rows[0] || null;
    },

    teacher: async (_, { id }) => {
      const result = await pool.query(
        "SELECT * FROM teachers WHERE id = $1",
        [id]
      );

      return result.rows[0] || null;
    },

    staffMember: async (_, { id }) => {
      const result = await pool.query(
        "SELECT * FROM staff WHERE id = $1",
        [id]
      );

      return result.rows[0] || null;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const handler = startServerAndCreateNextHandler(server);

module.exports = handler;