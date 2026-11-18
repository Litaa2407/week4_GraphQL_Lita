(async () => {
  const statuses = [];

  for (let i = 1; i <= 30; i++) {
    const res = await fetch("http://localhost:8080/service-a/api/hello");
    statuses.push(res.status);
    console.log(i, res.status);
  }

  const firstRateLimitedRequest = statuses.findIndex((status) => status === 429);
  const firstTwentyNormal = statuses.slice(0, 20).every((status) => status === 200);
  const lastTenRateLimited = statuses.slice(20).every((status) => status === 429);

  if (!firstTwentyNormal || firstRateLimitedRequest !== 20 || !lastTenRateLimited) {
    console.error("Hasil tidak sesuai: 20 request pertama harus berstatus 200, lalu 10 request berstatus 429.");
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error("Gagal menguji rate limit:", error.message);
  process.exitCode = 1;
});
