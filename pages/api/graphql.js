const { ApolloServer } = require("@apollo/server");
const {
  startServerAndCreateNextHandler,
} = require("@as-integrations/next");
const {
  ApolloServerPluginLandingPageLocalDefault,
} = require("@apollo/server/plugin/landingPage/default");
const { Pool } = require("pg");
const { verifyAppToken } = require("../../lib/auth");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
const studentServiceUrl =
  process.env.STUDENT_SERVICE_URL || "http://localhost:3001";
const teacherServiceUrl =
  process.env.TEACHER_SERVICE_URL || "http://localhost:3002";

async function callService(baseUrl, route, options = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${route}`, {
      ...options,
      signal: AbortSignal.timeout(2500),
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    const reason =
      error.name === "TimeoutError"
        ? "request timeout setelah 2.5 detik"
        : "tidak dapat dihubungi";
    throw new Error(`Service ${baseUrl} ${reason}`);
  }

  if (response.status === 204) return null;

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Service ${baseUrl} mengembalikan ${response.status}`);
  }
  return body;
}

function formatStaff(staff) {
  return {
    ...staff,
    tanggal:
      staff.tanggal instanceof Date
        ? staff.tanggal.toISOString().split("T")[0]
        : String(staff.tanggal).slice(0, 10),
  };
}

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
    students: () => callService(studentServiceUrl, "/students"),

    teachers: async () => {
      teacherResolverCallCount = 0;
      console.log("Query.teachers dipanggil: 1 kali");
      return callService(teacherServiceUrl, "/teachers");
    },

    staff: async () => {
      const result = await pool.query(
        "SELECT * FROM staff ORDER BY id"
      );
      return result.rows.map(formatStaff);
    },

    student: async (_, { id }) => {
      try {
        return await callService(studentServiceUrl, `/students/${encodeURIComponent(id)}`);
      } catch (error) {
        if (error.message === "Student tidak ditemukan") return null;
        throw error;
      }
    },

    teacher: async (_, { id }) => {
      try {
        return await callService(teacherServiceUrl, `/teachers/${encodeURIComponent(id)}`);
      } catch (error) {
        if (error.message === "Teacher tidak ditemukan") return null;
        throw error;
      }
    },

    staffMember: async (_, { id }) => {
      const result = await pool.query(
        "SELECT * FROM staff WHERE id = $1",
        [id]
      );

      const staff = result.rows[0];

      if (!staff) return null;

      return formatStaff(staff);
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
      return callService(
        studentServiceUrl,
        `/students?teacher_id=${encodeURIComponent(teacher.id)}`
      );
    },
  },

  // ==========================================
  // MUTATION
  // ==========================================
  Mutation: {

    // ==========================================
    // CREATE STUDENT
    // ==========================================
    createStudent: (_, input) =>
      callService(studentServiceUrl, "/students", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    // ==========================================
    // UPDATE STUDENT
    // ==========================================
    updateStudent: (_, input) => {
      const { id, ...student } = input;
      return callService(
        studentServiceUrl,
        `/students/${encodeURIComponent(id)}`,
        { method: "PUT", body: JSON.stringify(student) }
      );
    },

    // ==========================================
    // DELETE STUDENT
    // ==========================================
    deleteStudent: (_, { id }) =>
      callService(
        studentServiceUrl,
        `/students/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      ),
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

// NEXT.JS HANDLER
const apolloHandler = startServerAndCreateNextHandler(server, {
  context: async (req) => {
    return { user: req.authenticatedUser };
  },
});

const handler = async (req, res) => {
  if (req.method === "GET" && req.query?.query === undefined) {
    await apolloHandler(req, res);
    return;
  }

  const authorization = req.headers.authorization;
  const bearerToken = typeof authorization === "string"
    ? authorization.match(/^Bearer\s+(.+)$/i)?.[1]
    : undefined;
  const user = verifyAppToken(bearerToken);

  if (!user) {
    res.status(401).json({
      errors: [{ message: "Authentication required", extensions: { code: "UNAUTHENTICATED" } }],
    });
    return;
  }

  req.authenticatedUser = user;
  await apolloHandler(req, res);
};

module.exports = handler;