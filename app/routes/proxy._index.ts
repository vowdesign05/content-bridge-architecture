export const loader = async () => {
  return new Response("proxy ok", { status: 200, headers: { "Content-Type": "text/plain" } });
};
