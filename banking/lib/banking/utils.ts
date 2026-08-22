export function die(msg: string): never {
  throw new Error(msg)
}
