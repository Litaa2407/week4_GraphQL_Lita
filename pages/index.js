import Head from "next/head";
import { useRouter } from "next/router";
import styles from "@/styles/Login.module.css";

const { verifyAppToken } = require("@/lib/auth");

export default function Home({ user }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    await router.replace("/");
  }

  return (
    <>
      <Head>
        <title>Student GraphQL | Sign in</title>
        <meta name="description" content="Sign in to access the student GraphQL service" />
      </Head>
      <main className={styles.page}>
        <section className={styles.panel}>
          <header className={styles.header}>
            <span className={styles.mark}>SG</span>
            <span>STUDENT GRAPHQL</span>
          </header>

          {user ? (
            <div className={styles.content}>
              <p className={styles.eyebrow}>AUTHENTICATED SESSION</p>
              <h1>Welcome{user.name ? `, ${user.name}` : `, ${user.login}`}.</h1>
              <p className={styles.description}>
                Your GitHub identity is connected. The GraphQL endpoint now accepts your app session.
              </p>
              <div className={styles.actions}>
                <form action="/api/graphql" method="GET">
                  <button className={styles.primary} type="submit">Open GraphQL API</button>
                </form>
                <button className={styles.secondary} onClick={signOut} type="button">
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.content}>
              <p className={styles.eyebrow}>SECURE SIGN IN</p>
              <h1>Your student data, behind your account.</h1>
              <p className={styles.description}>
                Continue with GitHub. Your password stays with GitHub; this app receives only your profile and creates its own session.
              </p>
              <form action="/api/auth/github" method="GET">
                <button className={styles.primary} type="submit">
                  <span className={styles.githubMark} aria-hidden="true">GH</span>
                  Continue with GitHub
                </button>
              </form>
              <p className={styles.footnote}>Authorization uses a short-lived code and a server-side token exchange.</p>
            </div>
          )}

          <footer className={styles.footer}>
            <span>OAuth 2.0</span>
            <span>JWT session</span>
            <span>GraphQL</span>
          </footer>
        </section>
      </main>
    </>
  );
}

export function getServerSideProps({ req }) {
  const token = verifyAppToken(req.cookies?.app_session);
  const user = token ? { login: token.login, name: token.name } : null;

  return { props: { user } };
}
