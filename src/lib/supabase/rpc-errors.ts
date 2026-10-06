// HTTP status for an error raised by an owner-checked RPC (migrations
// 0005/0006): P0002 not found / not the owner (never reveal which), 55000
// illegal state, 22023 invalid argument.
export function statusForRpcError(error: { code?: string } | null | undefined): number {
  switch (error?.code) {
    case "P0002":
      return 404;
    case "55000":
      return 409;
    case "22023":
      return 400;
    default:
      return 500;
  }
}
