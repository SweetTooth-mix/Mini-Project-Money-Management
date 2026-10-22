/** Query-string helpers shared by pages and API routes (no database import). */
export type Search = { [key: string]: string | string[] | undefined };

export const param = (search: Search, key: string) =>
  typeof search[key] === "string" ? (search[key] as string) : "";
