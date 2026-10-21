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

## Express API Gateway

The [gateway project](./gateway/README.md) proxies this Next.js app as service-a on port `3000`, alongside a demo Express service-b on port `3001`. Start the gateway on port `8080` and access both services through `/service-a/*` and `/service-b/*`. The gateway README includes local run instructions, rate-limit testing, optional API-key configuration, and an architecture diagram.

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
